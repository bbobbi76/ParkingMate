"""Setup and mode switching checks: temporary folders and mocked server only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import web_connect as web
from bridge import Bridge
from field_monitor import FieldStore, monitor_snapshot


class WebSetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.patches = [patch.object(web, 'HERE', self.folder),
                        patch.object(web, 'CONFIG', self.folder / 'runtime/web-connection.json')]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_invalid_key_does_not_stop_capture_or_replace_settings(self):
        web.save_settings('https://saved.invalid', 'previous-key')
        previous = web.CONFIG.read_bytes()
        with patch.object(web, 'check', side_effect=ValueError('bad authentication')), \
                patch.object(web, 'stop_local') as stop, patch.object(web.subprocess, 'Popen') as process:
            with self.assertRaises(ValueError):
                web.start_forwarding('https://new.invalid', 'wrong-key')
        stop.assert_not_called()
        process.assert_not_called()
        self.assertEqual(web.CONFIG.read_bytes(), previous)

    def test_same_connected_settings_reopen_without_restarting_or_resetting(self):
        api = 'https://saved.invalid'
        web.save_settings(api, 'key')
        state = {'mode': 'forwarding', 'api': api}
        with patch.object(web, 'check', return_value={'vehicle_events_sent': 0}), \
                patch.object(web, 'local_state', return_value=state), patch.object(web, 'stop_local') as stop:
            self.assertEqual(web.start_forwarding(api, 'key')['vehicle_events_sent'], 0)
        stop.assert_not_called()

    def test_start_uses_separate_stable_server_folder_and_no_key_in_arguments(self):
        api, key = 'https://saved.invalid', 'private-unit-key'
        state = {'mode': 'forwarding', 'api': api}
        with patch.object(web, 'check', return_value={'vehicle_events_sent': 0}), \
                patch.object(web, 'local_state', side_effect=[None, state]), \
                patch.object(web.subprocess, 'Popen') as process, patch.object(web.time, 'sleep'):
            web.start_forwarding(api, key)
        args = process.call_args.args[0]
        self.assertIn('--forward', args)
        self.assertNotIn(key, args)
        self.assertIn(str(web.forwarding_folder(api)), args)
        self.assertEqual(json.loads(web.CONFIG.read_text())['sensor_key'], key)
        self.assertNotEqual(web.forwarding_folder(api), web.forwarding_folder('https://other.invalid'))

    def test_cleartext_remote_key_not_allowed_and_https_origin_accepted(self):
        with self.assertRaises(ValueError):
            web.validate_settings('http://remote.invalid', 'key')
        with self.assertRaises(ValueError):
            web.validate_settings('https://remote.invalid/api', 'key')
        self.assertEqual(web.validate_settings(' https://remote.invalid/ ', ' key '),
                         ('https://remote.invalid', 'key'))

    def test_error_never_displays_raw_server_text_or_key(self):
        error = requests.HTTPError('server echoed private-unit-key')
        error.response = Mock(status_code=401)
        self.assertIn('401', web.friendly_error(error))
        self.assertNotIn('private-unit-key', web.friendly_error(error))

    def test_capture_history_stays_separate_and_forwarding_restart_keeps_retry_id(self):
        capture = FieldStore(self.folder / 'field-runtime/bridge.sqlite')
        capture.enqueue('entry-stm32', 'IN', 'capture-test-event')
        api = 'https://saved.invalid'
        path = web.forwarding_folder(api) / 'bridge.sqlite'
        live = FieldStore(path, api)
        try:
            self.assertEqual(live.counts(), {})
            seq, _ = live.enqueue('exit-pico', 'OUT', 'real-event-id')
            live.close()
            live = FieldStore(path, api)
            repeated, fresh = live.enqueue('exit-pico', 'OUT', 'real-event-id')
            self.assertFalse(fresh)
            self.assertEqual(seq, repeated)
            bridge = Bridge(live, api, 'key')
            response = Mock(status_code=200)
            response.json.return_value = {'accepted': 0, 'duplicates': 0, 'errors': ['not saved']}
            sender = Mock(); sender.post.return_value = response
            self.assertFalse(bridge.send_once(sender))
            self.assertEqual(monitor_snapshot(bridge)['pending'], 1)
            response.json.return_value = {'accepted': 0, 'duplicates': 1, 'errors': []}
            self.assertTrue(bridge.send_once(sender))
            snapshot = monitor_snapshot(bridge)
            self.assertEqual((snapshot['mode'], snapshot['api'], snapshot['delivered']), ('forwarding', api, 1))
            self.assertTrue(snapshot['session']['recent'][0]['delivered'])
            self.assertEqual(snapshot['session']['exit'], 1)
            live.new_session()
            self.assertEqual(live.counts(), {1: 1})
            self.assertEqual(capture.session_snapshot()['entry'], 1)
        finally:
            live.close()
            capture.close()


if __name__ == '__main__':
    unittest.main()
