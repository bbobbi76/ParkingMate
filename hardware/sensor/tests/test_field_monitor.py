"""Field counter tests use temporary databases and loopback, never live devices."""
import csv
import io
import json
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge import Bridge
from field_monitor import FieldStore, make_field_handler, monitor_snapshot


class FieldFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'field.sqlite'
        self.store = FieldStore(self.path)
        self.bridge = Bridge(self.store, '', '', capture_only=True)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()


class FieldCounterTests(FieldFixture):
    def test_real_protocol_receipt_counts_once_and_acknowledges(self):
        session = 'a' * 32
        status = {'kind':'status','device':'entry-stm32','protocol':3,
                  'session':session,'a':0,'b':0,'queue':0}
        event = {'kind':'passage','device':'entry-stm32','protocol':3,
                 'session':session,'seq':1,'direction':'forward'}
        self.bridge.serial_line(json.dumps(status))
        self.assertEqual(self.bridge.serial_line(json.dumps(event)), 'ACK '+session+' 1\n')
        self.bridge.serial_line(json.dumps(event))
        self.bridge.event('exit-pico', 'OUT', 'b' * 32)
        self.bridge.event('exit-pico', 'OUT', 'b' * 32)
        snapshot = monitor_snapshot(self.bridge)
        self.assertEqual((snapshot['session']['entry'], snapshot['session']['exit']), (1, 1))
        self.assertEqual(snapshot['mode'], 'capture_only')

    def test_reset_preserves_dedup_and_exported_history(self):
        self.bridge.event('exit-pico', 'OUT', 'before-reset')
        self.store.new_session()
        self.bridge.event('exit-pico', 'OUT', 'before-reset')
        self.assertEqual(self.store.session_snapshot()['exit'], 0)
        self.bridge.event('entry-stm32', 'IN', 'after-reset')
        rows = list(csv.reader(io.StringIO(self.store.csv_bytes().decode('utf-8-sig'))))
        self.assertEqual(len(rows), 3)
        self.assertEqual([row[0] for row in rows[1:]], ['1', '2'])
        self.assertEqual([row[2] for row in rows[1:]], ['출차', '입차'])

    def test_restart_resumes_current_session(self):
        self.store.new_session()
        self.bridge.event('exit-pico', 'OUT', 'restart-event')
        self.store.close()
        self.store = FieldStore(self.path)
        state = self.store.session_snapshot()
        self.assertEqual((state['id'], state['exit']), (2, 1))
        seq, fresh = self.store.enqueue('exit-pico', 'OUT', 'restart-event')
        self.assertFalse(fresh)
        self.assertEqual(self.store.session_snapshot()['exit'], 1)

    def test_concurrent_retry_is_one_count(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: self.bridge.event('exit-pico', 'OUT', 'same-event'), range(24)))
        self.assertEqual(self.store.session_snapshot()['exit'], 1)


class FieldHTTPTests(FieldFixture):
    def setUp(self):
        super().setUp()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), make_field_handler(self.bridge, 'test-token'))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%d' % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        super().tearDown()

    def test_http_pico_retry_and_live_dashboard(self):
        body = {'deviceId':'exit-pico','direction':'OUT','eventId':'c'*32}
        for _ in range(2):
            self.assertEqual(requests.post(self.url+'/event', json=body, timeout=3).status_code, 204)
        heartbeat = {'deviceId':'exit-pico','a':1,'b':0,'queue':0,'faults':0,'storage_ok':True}
        self.assertEqual(requests.post(self.url+'/heartbeat', json=heartbeat, timeout=3).status_code, 204)
        snapshot = requests.get(self.url+'/api/monitor', timeout=3).json()
        self.assertEqual(snapshot['session']['exit'], 1)
        self.assertTrue(snapshot['devices']['exit-pico']['online'])
        self.assertEqual(snapshot['devices']['exit-pico']['status']['a'], 1)
        html = requests.get(self.url+'/', timeout=3)
        self.assertIn('test-token', html.text)
        self.assertNotIn('__FIELD_ACTION_TOKEN__', html.text)
        self.assertIn('no-store', html.headers['Cache-Control'])

    def test_new_test_requires_local_action_token_and_preserves_records(self):
        self.bridge.event('exit-pico', 'OUT', 'retained')
        self.assertEqual(requests.post(self.url+'/api/new-test', timeout=3).status_code, 403)
        headers = {'X-Field-Token':'test-token', 'Origin':'http://untrusted.invalid'}
        self.assertEqual(requests.post(self.url+'/api/new-test', headers=headers, timeout=3).status_code, 403)
        headers['Origin'] = self.url
        result = requests.post(self.url+'/api/new-test', headers=headers, timeout=3)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['session']['exit'], 0)
        export = requests.get(self.url+'/api/events.csv', timeout=3)
        self.assertIn('attachment;', export.headers['Content-Disposition'])
        self.assertTrue(export.content.startswith(b'\xef\xbb\xbf'))
        self.assertIn('출차', export.content.decode('utf-8-sig'))


if __name__ == '__main__':
    unittest.main()
