import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import connection
from check_connection import check

class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.folder=Path(self.temp.name)
        self.root=patch.object(connection,'HERE',self.folder); self.root.start()
        self.env=patch.dict(os.environ,{},clear=True); self.env.start()

    def tearDown(self):
        self.env.stop(); self.root.stop(); self.temp.cleanup()

    def test_local_defaults(self):
        self.assertEqual(connection.resolve(),('http://127.0.0.1:8787','dev-sensor'))

    def test_remote_requires_real_key(self):
        with self.assertRaises(ValueError):
            connection.resolve('https://example.invalid')

    def test_config_environment_and_explicit_priority(self):
        folder=self.folder/'runtime'; folder.mkdir()
        (folder/'connection.json').write_text(json.dumps({'api':'https://example.invalid','sensor_key':'config-key'}))
        self.assertEqual(connection.resolve(),('https://example.invalid','config-key'))
        os.environ['SENSOR_KEY']='env-key'
        self.assertEqual(connection.resolve()[1],'env-key')
        self.assertEqual(connection.resolve(key='explicit-key')[1],'explicit-key')

    def test_origin_only_without_embedded_credentials(self):
        for url in ['https://example.invalid/api','https://secret@example.invalid','file:///tmp','https://example.invalid/?key=x']:
            with self.assertRaises(ValueError):
                connection.resolve(url,'unit-key')

    def test_missing_explicit_config_is_not_silently_ignored(self):
        with self.assertRaises(ValueError):
            connection.resolve(config_path=self.folder/'missing.json')

    def test_preflight_does_not_send_vehicle_or_heartbeat(self):
        lot=Mock(); lot.json.return_value={'code':'wirari','sensorEnabled':True,'currentCount':7,'remaining':3}
        reply=Mock(status_code=200); reply.json.return_value={'accepted':0,'duplicates':0,'errors':[]}
        with patch('check_connection.requests.get',return_value=lot), patch('check_connection.requests.post',return_value=reply) as post:
            result=check('http://127.0.0.1:8787','unit-key')
        self.assertEqual(result['vehicle_events_sent'],0)
        self.assertFalse(result['physical_initial_count_verified'])
        post.assert_called_once()
        self.assertEqual(post.call_args.args[0],'http://127.0.0.1:8787/api/sensor/events')
        self.assertEqual(post.call_args.kwargs['json'],{'events':[]})
