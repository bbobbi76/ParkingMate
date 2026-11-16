"""Regression checks use temporary databases/loopback only; no real parking counts."""
import asyncio
import importlib.util
import json
import os
import sys
import tempfile
import threading
import time
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'pico_exit'))
from bridge import Bridge, make_handler
from bridge_store import Store
from gate import Gate
from outbox import Outbox


class GateTests(unittest.TestCase):
    def run_path(self, path, initial=0):
        gate = Gate(initial, 0, lambda a, b: a-b)
        now, count = 0, 0
        for state in path:
            now += 100
            count += gate.update(state, now)
            count += gate.update(state, now + 80)
        return count

    def test_complete_forward(self):
        self.assertEqual(self.run_path([0, 2, 3, 1, 0]), 1)

    def test_reverse_b_first(self):
        self.assertEqual(self.run_path([0, 1, 3, 2, 0]), 0)

    def test_backout_from_overlap(self):
        self.assertEqual(self.run_path([0, 2, 3, 2, 0]), 0)

    def test_a_only(self):
        self.assertEqual(self.run_path([0, 2, 0]), 0)

    def test_simultaneous_start(self):
        self.assertEqual(self.run_path([0, 3, 1, 0]), 0)

    def test_no_overlap_is_not_a_vehicle(self):
        self.assertEqual(self.run_path([0, 2, 0, 1, 0]), 0)

    def test_startup_blocked(self):
        self.assertEqual(self.run_path([3, 1, 0], initial=2), 0)
        self.assertEqual(self.run_path([3, 1, 0, 2, 3, 1, 0], initial=2), 1)

    def test_recovery_after_reverse(self):
        self.assertEqual(self.run_path([1, 3, 2, 0, 2, 3, 1, 0]), 1)

    def test_two_passages(self):
        self.assertEqual(self.run_path([2, 3, 1, 0] * 2), 2)

    def test_timeout_in_all_active_stages(self):
        for prefix in ([2], [2, 3], [2, 3, 1]):
            g = Gate(0, 0, lambda a, b: a-b)
            now = 100
            for state in prefix:
                g.update(state, now); g.update(state, now + 80); now += 100
            self.assertFalse(g.update(prefix[-1], 31000))
            self.assertFalse(g.update(0, 31100))
            self.assertFalse(g.update(0, 31180))
            self.assertEqual(g.faults, 1)

    def test_slow_forward_under_30_seconds_counts_once(self):
        g = Gate(0, 0, lambda a, b: a-b)
        count = 0
        for state, now in [(2, 100), (3, 4100), (1, 10100), (0, 12100)]:
            count += g.update(state, now)
            count += g.update(state, now + 80)
        self.assertEqual(count, 1)
        self.assertEqual(g.faults, 0)
        self.assertFalse(g.update(0, 32000))

    def test_short_noise_does_not_become_clear(self):
        g = Gate(0, 0, lambda a, b: a-b)
        g.update(2, 100); g.update(2, 180)
        g.update(3, 200); g.update(3, 280)
        g.update(0, 300); g.update(3, 310)
        self.assertEqual(g.state, 3)
        g.update(1, 400); g.update(1, 480)
        g.update(0, 500)
        self.assertTrue(g.update(0, 580))

    def test_ticks_wrap(self):
        period = 1 << 30
        diff = lambda a, b: ((a-b+period//2) % period) - period//2
        g = Gate(0, period-200, diff)
        count = 0
        for raw, when in [(2, period-150), (2, period-70), (3, period-50),
                          (3, 30), (1, 100), (1, 180), (0, 200), (0, 280)]:
            count += g.update(raw, when)
        self.assertEqual(count, 1)


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'bridge.sqlite'
        self.store = Store(self.path)
        self.bridge = Bridge(self.store, 'http://unused.invalid', 'unit-key')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_duplicate_after_lost_http_response_and_restart(self):
        first = self.store.enqueue('exit-pico', 'OUT', 'event-1')[0]
        self.store.delivered(self.store.pending()[0])
        self.store.close(); self.store = Store(self.path)
        seq, new = self.store.enqueue('exit-pico', 'OUT', 'event-1')
        self.assertEqual(seq, first)
        self.assertFalse(new)
        self.assertIsNone(self.store.pending())

    def test_concurrent_retry_one_record(self):
        with ThreadPoolExecutor(max_workers=8) as workers:
            rows = list(workers.map(lambda _: self.store.enqueue('exit-pico', 'OUT', 'same'), range(20)))
        self.assertEqual(sum(new for _, new in rows), 1)
        self.assertEqual(len({seq for seq, _ in rows}), 1)

    def test_seq_keeps_increasing_if_clock_goes_back(self):
        first = self.store.enqueue('entry-stm32', 'IN')[0]
        with patch('bridge_store.time.time_ns', return_value=0):
            second = self.store.enqueue('entry-stm32', 'IN')[0]
        self.assertEqual(second, first + 1)

    def test_legacy_input_is_not_deduplicated_by_time(self):
        self.store.enqueue('entry-stm32', 'IN')
        self.store.enqueue('entry-stm32', 'IN')
        self.assertEqual(self.store.counts(), {0: 2})

    def test_invalid_gate_direction(self):
        for device, direction in [('exit-pico', 'IN'), ('entry-stm32', 'OUT'), ('unknown', 'IN')]:
            with self.assertRaises(ValueError):
                self.store.enqueue(device, direction)

    def test_fragment_debug_does_not_count(self):
        for line in ['I', 'N', 'OUT', '#STATUS a=0 b=0 faults=0', '{"direction":"IN"}', 'IN,123']:
            self.bridge.serial_line(line)
        self.assertEqual(self.store.counts(), {})
        self.bridge.serial_line('IN')
        self.assertEqual(self.store.counts(), {})
        self.bridge.allow_legacy = True
        self.bridge.serial_line('IN')
        self.assertEqual(self.store.counts(), {0: 1})

    def test_no_phantom_online_heartbeat(self):
        self.assertEqual(self.bridge.live_devices(), [])
        self.bridge.touch('exit-pico')
        self.assertEqual(self.bridge.live_devices(), ['exit-pico'])
        self.bridge.seen['exit-pico'] -= 13
        self.assertEqual(self.bridge.live_devices(), [])

    def response_session(self, status=200, body=None, error=None):
        class Response:
            status_code = status
            def json(self):
                if error:
                    raise error
                return body
            def close(self):
                pass
        class Session:
            calls = []
            def post(self, url, **kwargs):
                self.calls.append((url, kwargs))
                return Response()
        return Session()

    def test_server_error_or_partial_accept_keeps_event(self):
        self.store.enqueue('exit-pico', 'OUT', 'e1')
        responses = [[], {}, {'accepted': 0, 'duplicates': 0, 'errors': ['unregistered']},
                     {'accepted': 1, 'duplicates': 0, 'errors': ['partial']},
                     {'accepted': True, 'duplicates': 0, 'errors': []}]
        for body in responses:
            self.assertFalse(self.bridge.send_once(self.response_session(body=body)))
            self.assertIsNotNone(self.store.pending())
        self.assertFalse(self.bridge.send_once(self.response_session(status=503)))
        self.assertFalse(self.bridge.send_once(self.response_session(error=ValueError('invalid JSON'))))

    def test_backend_confirmation_or_duplicate_marks_delivered(self):
        for index, body in enumerate([{'accepted': 1, 'duplicates': 0, 'errors': []},
                                       {'accepted': 0, 'duplicates': 1, 'errors': []}]):
            self.store.enqueue('exit-pico', 'OUT', 'e' + str(index))
            session = self.response_session(body=body)
            self.assertTrue(self.bridge.send_once(session))
            self.assertEqual(session.calls[0][0], 'http://unused.invalid/api/sensor/events')
            self.assertEqual(session.calls[0][1]['headers'], {'X-Sensor-Key': 'unit-key'})
            self.assertIsNone(self.store.pending())

    def test_legacy_import_preserves_seq_and_original_files(self):
        folder = Path(self.temp.name)
        (folder/'bridge_state.json').write_text(json.dumps({'entry-stm32': 41}))
        body = {'deviceId': 'entry-stm32', 'seq': 41, 'direction': 'IN'}
        (folder/'queue.jsonl').write_text(json.dumps(body) + '\n')
        self.store.import_legacy(folder)
        self.store.import_legacy(folder)
        self.assertEqual(self.store.pending()[1], body)
        self.assertEqual(self.store.counts(), {0: 1})
        self.assertTrue((folder/'queue.jsonl').exists())

    def test_corrupt_legacy_import_does_not_partially_commit(self):
        folder = Path(self.temp.name)
        (folder/'queue.jsonl').write_text('{"deviceId":"entry-stm32","seq":1,"direction":"IN"}\n{"seq":2}')
        with self.assertRaises(ValueError):
            self.store.import_legacy(folder)
        self.assertEqual(self.store.counts(), {})

    def test_database_cannot_silently_switch_backend(self):
        other = Path(self.temp.name)/'other.sqlite'
        store = Store(other, 'http://one'); store.close()
        with self.assertRaises(ValueError):
            Store(other, 'http://two')


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name)/'http.sqlite')
        self.bridge = Bridge(self.store, 'http://unused.invalid', 'unit-key')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.bridge))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.store.close(); self.temp.cleanup()

    def test_http_204_after_durable_receipt_and_retry(self):
        event = {'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': 'same-event'}
        for _ in range(2):
            self.assertEqual(requests.post(self.url+'/event', json=event, timeout=2).status_code, 204)
        self.assertEqual(self.store.counts(), {0: 1})
        second = Store(Path(self.temp.name)/'http.sqlite')
        self.assertEqual(second.counts(), {0: 1}); second.close()

    def test_bad_requests_are_not_acknowledged(self):
        for body in ([], {}, {'deviceId': 'exit-pico', 'direction': 'IN'},
                     {'deviceId': 'intruder', 'direction': 'OUT'},
                     {'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': None}):
            self.assertEqual(requests.post(self.url+'/event', json=body, timeout=2).status_code, 400)
        self.assertEqual(requests.post(self.url+'/event', data='x'*2049, timeout=2).status_code, 413)
        self.assertEqual(self.store.counts(), {})

    def test_original_team_body_still_accepted(self):
        self.bridge.allow_legacy = True
        self.assertEqual(requests.post(self.url+'/event', json={'deviceId': 'exit-pico', 'direction': 'OUT'}, timeout=2).status_code, 204)
        self.assertEqual(requests.post(self.url+'/event', data='OUT', timeout=2).status_code, 204)
        self.assertEqual(self.store.counts(), {0: 2})

    def test_optional_token(self):
        self.bridge.allow_legacy = True
        self.bridge.token = 'private-test-token'
        self.assertEqual(requests.post(self.url+'/event', data='OUT', timeout=2).status_code, 401)
        self.assertEqual(requests.post(self.url+'/event', data='OUT', headers={'X-Bridge-Key': self.bridge.token}, timeout=2).status_code, 204)

    def test_storage_failure_is_503_not_204(self):
        self.bridge.allow_legacy = True
        import sqlite3
        with patch.object(self.store, 'enqueue', side_effect=sqlite3.OperationalError('disk full')):
            self.assertEqual(requests.post(self.url+'/event', data='OUT', timeout=2).status_code, 503)

    def test_idless_events_rejected_by_default(self):
        for body in ({'deviceId': 'exit-pico', 'direction': 'OUT'},
                     {'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': ''}):
            self.assertEqual(requests.post(self.url+'/event', json=body, timeout=2).status_code, 400)
        self.assertEqual(requests.post(self.url+'/event', data='OUT', timeout=2).status_code, 400)
        self.assertEqual(self.store.counts(), {})

    def test_health_has_actual_board_state_without_secrets(self):
        self.bridge.capture_only = True
        first = requests.get(self.url+'/health', timeout=2).json()
        self.assertEqual(first['mode'], 'capture_only')
        self.assertFalse(first['devices']['entry-stm32']['online'])
        self.bridge.touch('entry-stm32', {'a': 0, 'b': 0, 'queue': 0})
        second = requests.get(self.url+'/health', timeout=2).json()
        self.assertTrue(second['devices']['entry-stm32']['online'])
        self.assertNotIn('unit-key', json.dumps(second))
        self.assertEqual(self.store.counts(), {})


class SerialProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'serial.sqlite'
        self.store = Store(self.path)
        self.bridge = Bridge(self.store, '', '', capture_only=True)

    def tearDown(self):
        self.store.close(); self.temp.cleanup()

    @staticmethod
    def status(session=''):
        return json.dumps({'kind':'status','device':'entry-stm32','protocol':3,
                           'session':session,'a':0,'b':0,'queue':0,'faults':0})

    @staticmethod
    def passage(session, seq=1, direction='forward'):
        return json.dumps({'kind':'passage','device':'entry-stm32','protocol':3,
                           'session':session,'seq':seq,'direction':direction})

    def handshake(self):
        return self.bridge.serial_line(self.status()).split()[1]

    def test_repeated_empty_status_reuses_pending_session_until_ack(self):
        first = self.handshake()
        self.assertEqual(self.handshake(), first)
        self.assertEqual(self.bridge.serial_line(self.passage(first)), 'ACK '+first+' 1\n')
        self.assertNotEqual(self.handshake(), first)

    def test_lost_ack_duplicate_has_one_record_and_same_ack(self):
        session = self.handshake()
        replies = [self.bridge.serial_line(self.passage(session)) for _ in range(3)]
        self.assertEqual(replies, ['ACK '+session+' 1\n']*3)
        self.assertEqual(self.store.counts(), {0:1})

    def test_reconnect_requires_status_and_restart_keeps_deduplication(self):
        session = self.handshake()
        ack = self.bridge.serial_line(self.passage(session))
        self.store.close(); self.store = Store(self.path)
        self.bridge = Bridge(self.store, '', '', capture_only=True)
        self.assertIsNone(self.bridge.serial_line(self.passage(session)))
        self.bridge.serial_line(self.status(session))
        self.assertEqual(self.bridge.serial_line(self.passage(session)), ack)
        self.assertEqual(self.store.counts(), {0:1})
        self.bridge.serial_connected()
        self.assertIsNone(self.bridge.serial_line(self.passage(session)))

    def test_new_boot_reusing_sequence_is_new_event(self):
        first = self.handshake(); self.bridge.serial_line(self.passage(first))
        second = self.handshake(); self.bridge.serial_line(self.passage(second))
        self.assertNotEqual(first, second)
        self.assertEqual(self.store.counts(), {0:2})

    def test_invalid_session_sequence_or_reverse_not_acknowledged(self):
        session = self.handshake()
        for frame in (self.passage('b'*32), self.passage(session, 0),
                      self.passage(session, True), self.passage(session, 2**32),
                      self.passage(session, 1, 'reverse')):
            self.assertIsNone(self.bridge.serial_line(frame))
        self.assertEqual(self.store.counts(), {})

    def test_storage_failure_never_acknowledged(self):
        import sqlite3
        session = self.handshake()
        with patch.object(self.store, 'enqueue', side_effect=sqlite3.OperationalError('disk full')):
            with self.assertRaises(sqlite3.OperationalError):
                self.bridge.serial_line(self.passage(session))
        self.assertEqual(self.store.counts(), {})

    def test_capture_only_never_sends_events_or_heartbeat(self):
        from unittest.mock import Mock
        session = self.handshake(); self.bridge.serial_line(self.passage(session))
        client = Mock()
        self.assertFalse(self.bridge.send_once(client))
        client.post.assert_not_called()
        with patch('bridge.requests.Session') as network:
            self.bridge.sender()
            network.assert_not_called()
        self.assertEqual(self.store.counts(), {0:1})


class OutboxTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_cwd = os.getcwd(); os.chdir(self.temp.name)
        self.sync = patch('os.sync', create=True); self.sync.start()
        self.event = {'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': 'a'*32}

    def tearDown(self):
        self.sync.stop(); os.chdir(self.old_cwd); self.temp.cleanup()

    def test_reboot_keeps_same_event_id(self):
        q = Outbox(); q.append(self.event)
        recovered = Outbox()
        self.assertEqual(recovered.items, [self.event])
        recovered.acknowledge(recovered.items[0])
        self.assertEqual(Outbox().items, [])

    def test_one_corrupt_snapshot_uses_last_valid(self):
        q = Outbox(); q.append(self.event); q.save()
        Path(q.PATHS[q.slot]).write_text('broken')
        recovered = Outbox()
        self.assertFalse(recovered.hard_fault)
        self.assertEqual(recovered.items, [self.event])

    def test_both_corrupt_snapshots_stop_silent_reinitialization(self):
        for name in Outbox.PATHS:
            Path(name).write_text('broken')
        q = Outbox()
        self.assertTrue(q.hard_fault)
        self.assertFalse(q.append(self.event))

    def test_failed_ack_write_retains_event(self):
        q = Outbox(); q.append(self.event)
        with patch.object(q, 'save', return_value=False):
            q.acknowledge(self.event)
        self.assertEqual(q.items, [self.event])

    def test_capacity_fault_is_visible(self):
        q = Outbox(1); q.append(self.event)
        self.assertFalse(q.append(dict(self.event, eventId='b'*32)))
        self.assertEqual(q.dropped, 1)


# Only network.WLAN is MicroPython-specific; the HTTP coroutine runs unchanged.
with patch.dict(sys.modules, {'network': types.SimpleNamespace()}):
    spec = importlib.util.spec_from_file_location('pico_link_for_tests', ROOT/'pico_exit/link.py')
    link_module = importlib.util.module_from_spec(spec); spec.loader.exec_module(link_module)

class PicoHTTPTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, code, body=b'', delay=0):
        request = []
        async def handler(reader, writer):
            headers = await reader.readuntil(b'\r\n\r\n')
            size = int(next(line.split(b':', 1)[1] for line in headers.split(b'\r\n') if line.lower().startswith(b'content-length:')))
            request.append((headers, json.loads(await reader.readexactly(size))))
            await asyncio.sleep(delay)
            writer.write(('HTTP/1.0 %d Result\r\nContent-Length: %d\r\n\r\n' % (code, len(body))).encode()+body)
            await writer.drain(); writer.close(); await writer.wait_closed()
        server = await asyncio.start_server(handler, '127.0.0.1', 0)
        link = link_module.Link.__new__(link_module.Link)
        link.config = types.SimpleNamespace(BRIDGE_HOST='127.0.0.1', BRIDGE_PORT=server.sockets[0].getsockname()[1], BRIDGE_TOKEN='')
        ticks = []
        async def sampling():
            for _ in range(10):
                ticks.append(time.monotonic()); await asyncio.sleep(0.005)
        event = {'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': 'a'*32}
        try:
            result, _ = await asyncio.gather(link.post(event), sampling())
            return result, request, ticks
        finally:
            server.close(); await server.wait_closed()

    async def test_204_and_sampling_continues_while_waiting(self):
        result, requests_seen, ticks = await self.exercise(204, delay=0.15)
        self.assertTrue(result)
        self.assertTrue(requests_seen[0][0].startswith(b'POST /event HTTP/1.0'))
        self.assertEqual(len(ticks), 10)
        self.assertEqual(requests_seen[0][1]['direction'], 'OUT')

    async def test_http_failure_does_not_acknowledge(self):
        with self.assertRaises(OSError):
            await self.exercise(503)

    async def test_200_without_explicit_acceptance_fails(self):
        with self.assertRaises(ValueError):
            await self.exercise(200, b'{"accepted":false}')


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('pico_deploy_for_tests', ROOT/'pico_exit/deploy.py')
        self.module = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory()
        self.local = Path(self.temp.name)
        for name in self.module.FILES:
            (self.local/name).write_text('# valid Python\n', encoding='utf-8')
        self.calls = []
        def remote(port, *commands, capture=False):
            self.calls.append(commands)
            if commands[0] == 'exec' and 'sys.implementation' in commands[1]:
                return 'Raspberry Pi Pico 2 W with RP2350'
            if commands[0] == 'exec' and 'json.dumps(os.listdir())' in commands[1]:
                return '[]'
            return ''
        self.root_patch = patch.object(self.module, 'ROOT', self.local); self.root_patch.start()
        self.port_patch = patch.object(self.module, 'select_port', return_value='test-port'); self.port_patch.start()
        self.remote_patch = patch.object(self.module, 'remote', side_effect=remote); self.mock_remote = self.remote_patch.start()

    def tearDown(self):
        self.remote_patch.stop(); self.port_patch.stop(); self.root_patch.stop(); self.temp.cleanup()

    def test_stage_compile_then_activate_and_reset(self):
        self.module.deploy()
        compile_at = next(i for i, call in enumerate(self.calls) if call[0] == 'exec' and 'compile(f.read()' in call[1])
        activate_at = next(i for i, call in enumerate(self.calls) if call[0] == 'exec' and 'os.rename(' in call[1])
        self.assertLess(compile_at, activate_at)
        self.assertEqual(self.calls[-1], ('reset',))
        record = json.loads((self.local/'.local/deployment.json').read_text())
        self.assertNotIn('config.py', record['files'])
        self.assertFalse(record['sensor_passages_verified'])

    def test_local_syntax_error_never_contacts_board(self):
        (self.local/'main.py').write_text('if broken syntax', encoding='utf-8')
        with self.assertRaises(SyntaxError):
            self.module.deploy()
        self.mock_remote.assert_not_called()

    def test_device_compile_failure_resumes_original_without_activation(self):
        original = self.mock_remote.side_effect
        def fail_compile(port, *commands, **kwargs):
            if commands[0] == 'exec' and 'compile(f.read()' in commands[1]:
                raise RuntimeError('MicroPython syntax rejected')
            return original(port, *commands, **kwargs)
        self.mock_remote.side_effect = fail_compile
        with self.assertRaises(RuntimeError):
            self.module.deploy()
        self.assertFalse(any(c[0] == 'exec' and 'os.rename(' in c[1] for c in self.calls))
        self.assertEqual(self.calls[-1], ('reset',))

if __name__ == '__main__':
    unittest.main()
