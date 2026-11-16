"""Actual forward-mode subprocess against a loopback fixture, no live server/USB."""
import json
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from field_monitor import FieldStore
from check_connection import check


class ForwardProcessTest(unittest.TestCase):
    def test_real_forward_process_retry_and_restart(self):
        stored = set()
        count = [0]
        reject = [True]
        class Backend(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def send_json(self, body):
                raw = json.dumps(body).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers(); self.wfile.write(raw)
            def do_GET(self):
                self.send_json({'code':'wirari','sensorEnabled':True,'currentCount':count[0]})
            def do_POST(self):
                if self.headers.get('X-Sensor-Key') != 'unit-test-key':
                    self.send_error(401); return
                body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                if self.path.endswith('/heartbeat'):
                    self.send_json({'status':'ok'}); return
                accepted = duplicates = 0
                errors = []
                for event in body['events']:
                    if reject[0]:
                        errors.append('temporary fixture failure'); continue
                    key = (event['deviceId'], event['seq'])
                    if key in stored:
                        duplicates += 1
                    else:
                        stored.add(key); accepted += 1
                        count[0] += 1 if event['direction'] == 'IN' else -1
                self.send_json({'accepted':accepted,'duplicates':duplicates,'errors':errors})

        backend = ThreadingHTTPServer(('127.0.0.1', 0), Backend)
        worker = threading.Thread(target=backend.serve_forever, daemon=True); worker.start()
        api = 'http://127.0.0.1:%d' % backend.server_port
        process = None
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            config = folder / 'config.json'
            config.write_text(json.dumps({'api':api,'sensor_key':'unit-test-key'}))
            capture = FieldStore(folder / 'field-runtime/bridge.sqlite')
            capture.enqueue('entry-stm32', 'IN', 'old-capture'); capture.close()
            with socket.socket() as free:
                free.bind(('127.0.0.1', 0)); port = free.getsockname()[1]
            url = 'http://127.0.0.1:%d' % port
            def wait_for(predicate):
                until = time.monotonic()+12
                while time.monotonic()<until:
                    try:
                        result = requests.get(url+'/api/monitor', timeout=1).json()
                        if predicate(result): return result
                    except requests.RequestException:
                        pass
                    time.sleep(.1)
                self.fail('Isolated forward process did not reach expected state')
            def start():
                return subprocess.Popen([sys.executable, str(ROOT/'field_monitor.py'), '--forward',
                                         '--config', str(config), '--state-dir', str(folder/'web-runtime'),
                                         '--host','127.0.0.1','--port',str(port),'--serial='],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            def stop():
                html = requests.get(url+'/', timeout=2).text
                token = re.search(r"const actionToken='([a-f0-9]+)'", html)[1]
                requests.post(url+'/api/stop',headers={'X-Field-Token':token},timeout=2).raise_for_status()
                process.wait(timeout=15)
            try:
                self.assertEqual(check(api,'unit-test-key')['vehicle_events_sent'],0)
                process = start()
                initial = wait_for(lambda s: s['mode']=='forwarding')
                self.assertEqual((initial['pending'],initial['session']['entry']), (0,0))
                event={'deviceId':'exit-pico','direction':'OUT','eventId':'only-new-fixture-event'}
                for _ in range(2):
                    self.assertEqual(requests.post(url+'/event',json=event,timeout=2).status_code,204)
                wait_for(lambda s: s['pending']==1)
                self.assertEqual(count[0],0)
                reject[0]=False
                state=wait_for(lambda s: s['delivered']==1)
                self.assertEqual((state['pending'],state['session']['exit'],count[0]),(0,1,-1))
                self.assertTrue(state['session']['recent'][0]['delivered'])
                stop()
                process=start()
                wait_for(lambda s:s['delivered']==1)
                requests.post(url+'/event',json=event,timeout=2).raise_for_status()
                state=wait_for(lambda s:s['session']['exit']==1)
                self.assertEqual((count[0],len(stored)),(-1,1))
                stop(); process=None
            finally:
                if process and process.poll() is None:
                    process.terminate(); process.wait(timeout=10)
                backend.shutdown(); backend.server_close(); worker.join(3)


if __name__=='__main__':
    unittest.main()
