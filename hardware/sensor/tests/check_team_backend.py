"""Run the real team backend with an isolated in-memory DB, then stop it.
Requires backend/build/libs/app.jar. Never connects to a deployed server.
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from bridge import Bridge, make_handler
from bridge_store import Store
from check_connection import check


def main():
    jar = next((parent / 'backend/build/libs/app.jar' for parent in ROOT.parents
                if (parent / 'backend/build.gradle').exists()), ROOT.parent / 'backend/build/libs/app.jar')
    if not jar.exists():
        raise RuntimeError('Build the team backend jar first')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    api = 'http://127.0.0.1:' + str(port)
    env = os.environ.copy()
    env.update(DATABASE_URL='jdbc:h2:mem:sensor_verify;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH',
               DATABASE_USERNAME='sa', DATABASE_PASSWORD='', PORT=str(port), SENSOR_KEY='integration-sensor',
               ADMIN_KEY='integration-admin', ADMIN_OPEN='false', DEMO_CLOCK='')
    ROOT.joinpath('runtime').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='verification-', dir=ROOT/'runtime') as temporary:
        work = Path(temporary)
        with (work/'backend.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(['java', '-jar', str(jar), '--server.address=127.0.0.1'],
                                       cwd=work, env=env, stdout=log, stderr=subprocess.STDOUT,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            try:
                deadline = time.monotonic() + 180
                while True:
                    try:
                        response = requests.get(api+'/api/lots/wirari', timeout=0.5)
                        response.raise_for_status(); before = response.json(); break
                    except requests.RequestException:
                        if process.poll() is not None or time.monotonic() >= deadline:
                            raise RuntimeError('Isolated backend failed to start: ' + (work/'backend.log').read_text(encoding='utf-8')[-2500:])
                        time.sleep(0.25)
                store = Store(work/'bridge.sqlite', api)
                bridge = Bridge(store, api, 'integration-sensor')
                http = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(bridge))
                thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
                try:
                    checked = check(api, 'integration-sensor')
                    assert checked['vehicle_events_sent'] == 0
                    hello = {'kind': 'status', 'device': 'entry-stm32', 'protocol': 3,
                             'session': '', 'a': 0, 'b': 0}
                    serial_session = bridge.serial_line(json.dumps(hello)).split()[1]
                    passage = json.dumps({'kind': 'passage', 'device': 'entry-stm32', 'protocol': 3,
                                          'session': serial_session, 'seq': 1, 'direction': 'forward'})
                    for _ in range(2):
                        assert bridge.serial_line(passage) == 'ACK %s 1\n' % serial_session
                    assert store.counts() == {0: 1}
                    row_id, event = store.pending()
                    # Server commits, but the bridge loses the response before saving delivery.
                    lost_response = requests.post(api+'/api/sensor/events', json={'events': [event]},
                                                  headers={'X-Sensor-Key': 'integration-sensor'}, timeout=5)
                    assert lost_response.json() == {'accepted': 1, 'duplicates': 0, 'errors': []}
                    with requests.Session() as session:
                        assert bridge.send_once(session)  # Same seq -> duplicates=1, not another entry.
                    entered = requests.get(api+'/api/lots/wirari', timeout=5).json()
                    assert entered['currentCount'] == before['currentCount'] + 1
                    if before['remaining'] is not None:
                        assert entered['remaining'] == before['remaining'] - 1
                    event_id = 'integration-exit-once'
                    for _ in range(2):
                        reply = requests.post('http://127.0.0.1:%d/event' % http.server_port,
                                              json={'deviceId': 'exit-pico', 'direction': 'OUT', 'eventId': event_id}, timeout=5)
                        assert reply.status_code == 204
                    with requests.Session() as session:
                        assert bridge.send_once(session)
                    after = requests.get(api+'/api/lots/wirari', timeout=5).json()
                    assert after['currentCount'] == before['currentCount']
                    assert after['remaining'] == before['remaining']
                    assert store.counts() == {1: 2}
                    evidence = {'backend': 'real Spring Boot, isolated H2 memory DB',
                                'entry_delta': entered['currentCount']-before['currentCount'],
                                'exit_delta': after['currentCount']-entered['currentCount'],
                                'backend_response_loss_retried_without_duplicate': True,
                                'stm32_lost_ack_counted_once': True,
                                'empty_batch_authentication_check': True,
                                'pico_duplicate_http_counted_once': True,
                                'physical_sensor_passages': False, 'production_api_used': False}
                    (ROOT/'runtime/backend-verification.json').write_text(json.dumps(evidence, indent=2)+'\n', encoding='utf-8')
                    print(json.dumps(evidence, indent=2))
                finally:
                    http.shutdown(); http.server_close(); thread.join(); store.close()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(timeout=5)

if __name__ == '__main__':
    main()
