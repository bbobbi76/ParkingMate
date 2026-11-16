"""Local counter, optionally forwarding new records with --forward.

Capture and forwarding use separate databases. Dashboard routes are local only.
"""
import argparse
import csv
import hmac
import io
import ipaddress
import json
import os
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from bridge import Bridge, make_handler, serial_reader
from bridge_store import Store
from connection import resolve

HERE = Path(__file__).resolve().parent
SERVICE = 'parkingmate-field-monitor-v1'
KST = timezone(timedelta(hours=9))


class FieldStore(Store):
    def __init__(self, path, api=None):
        super().__init__(path, api)
        with self.lock, self.db:
            self.db.execute('''CREATE TABLE IF NOT EXISTS field_sessions (
                id INTEGER PRIMARY KEY, started_at TEXT NOT NULL,
                start_after INTEGER NOT NULL)''')
            if not self.db.execute('SELECT 1 FROM field_sessions LIMIT 1').fetchone():
                self.new_session()

    def new_session(self):
        # Advancing a display boundary preserves source-ID deduplication forever.
        with self.lock, self.db:
            last_id = self.db.execute('SELECT COALESCE(MAX(id),0) FROM events').fetchone()[0]
            self.db.execute('INSERT INTO field_sessions(started_at,start_after) VALUES(?,?)',
                            (datetime.now(timezone.utc).isoformat(), last_id))
            return self.session_snapshot()

    def session_snapshot(self):
        with self.lock:
            session_id, started_at, boundary = self.db.execute(
                'SELECT id,started_at,start_after FROM field_sessions ORDER BY id DESC LIMIT 1').fetchone()
            counts = dict(self.db.execute(
                'SELECT device,COUNT(*) FROM events WHERE id>? GROUP BY device', (boundary,)))
            rows = self.db.execute(
                'SELECT id,body,delivered FROM events WHERE id>? ORDER BY id DESC LIMIT 20', (boundary,)).fetchall()
            return {'id': session_id, 'started_at': started_at,
                    'entry': counts.get('entry-stm32', 0), 'exit': counts.get('exit-pico', 0),
                    'recent': [{'id': n, **json.loads(body), 'delivered': bool(delivered)}
                               for n, body, delivered in rows]}

    def csv_bytes(self):
        buffer = io.StringIO(newline='')
        writer = csv.writer(buffer)
        writer.writerow(['테스트', '노트북 수신 시각(KST)', '구분', '장치', '기록 번호'])
        with self.lock:
            rows = self.db.execute('''SELECT e.body,
                (SELECT s.id FROM field_sessions s WHERE s.start_after<e.id
                 ORDER BY s.id DESC LIMIT 1)
                FROM events e ORDER BY e.id''').fetchall()
        for body, session_id in rows:
            event = json.loads(body)
            occurred = datetime.fromisoformat(event['occurredAt']).astimezone(KST)
            writer.writerow([session_id, occurred.strftime('%Y-%m-%d %H:%M:%S'),
                             '입차' if event['direction'] == 'IN' else '출차',
                             event['deviceId'], event['seq']])
        return buffer.getvalue().encode('utf-8-sig')


def monitor_snapshot(bridge):
    result = bridge.snapshot()
    result.update({'service': SERVICE, 'session': bridge.store.session_snapshot(),
                   'server_time': datetime.now(timezone.utc).isoformat()})
    result['api'] = bridge.api if not bridge.capture_only else None
    return result


def make_field_handler(bridge, action_token):
    parent = make_handler(bridge)

    class FieldHandler(parent):
        def local_client(self):
            try:
                return ipaddress.ip_address(self.client_address[0]).is_loopback
            except ValueError:
                return False

        def payload(self, content, content_type, disposition=None):
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Security-Policy',
                             "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                             "style-src 'self' 'unsafe-inline'; connect-src 'self'; "
                             "img-src 'self' data:; object-src 'none'; frame-ancestors 'none'")
            if disposition:
                self.send_header('Content-Disposition', disposition)
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(content)
            self.close_connection = True

        def do_GET(self):
            path = urlsplit(self.path).path
            if path not in ('/', '/dashboard', '/api/monitor', '/api/events.csv'):
                return super().do_GET()
            if not self.local_client():
                return self.respond(403)
            try:
                if path in ('/', '/dashboard'):
                    html = (HERE / 'field_dashboard.html').read_text(encoding='utf-8')
                    return self.payload(html.replace('__FIELD_ACTION_TOKEN__', action_token).encode(),
                                        'text/html; charset=utf-8')
                if path == '/api/monitor':
                    return self.payload(json.dumps(monitor_snapshot(bridge)).encode(), 'application/json')
                name = 'parkingmate-field-' + datetime.now(KST).strftime('%Y%m%d-%H%M%S') + '.csv'
                return self.payload(bridge.store.csv_bytes(), 'text/csv; charset=utf-8',
                                    'attachment; filename="' + name + '"')
            except (OSError, sqlite3.Error):
                return self.respond(503)

        def do_POST(self):
            if self.path not in ('/api/new-test', '/api/stop'):
                return super().do_POST()
            if not self.local_client() or not hmac.compare_digest(
                    self.headers.get('X-Field-Token', '').encode(), action_token.encode()):
                return self.respond(403)
            origin = self.headers.get('Origin')
            if origin and origin != 'http://' + self.headers.get('Host', ''):
                return self.respond(403)
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Length', '0') != '0':
                return self.respond(400)
            try:
                if self.path == '/api/new-test':
                    bridge.store.new_session()
                    return self.payload(json.dumps(monitor_snapshot(bridge)).encode(), 'application/json')
                self.respond(204)
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            except sqlite3.Error:
                return self.respond(503)

    return FieldHandler


def main():
    parser = argparse.ArgumentParser(description='Local ParkingMate field counter')
    parser.add_argument('--serial', default='auto')
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=9000)
    parser.add_argument('--state-dir', type=Path)
    parser.add_argument('--forward', action='store_true')
    parser.add_argument('--config', type=Path)
    args = parser.parse_args()
    api, key = '', ''
    if args.forward:
        if not args.config or not args.state_dir:
            parser.error('--forward requires --config and a separate --state-dir')
        # Exact private settings from the launcher take precedence over old env vars.
        settings = json.loads(args.config.read_text(encoding='utf-8-sig'))
        api, key = resolve(settings.get('api'), settings.get('sensor_key'), args.config)
        if not settings.get('sensor_key'):
            parser.error('Missing sensor key in private settings')
    state_dir = args.state_dir or HERE / 'field-runtime'
    if args.forward and state_dir.resolve() == (HERE / 'field-runtime').resolve():
        parser.error('Capture history cannot be forwarded; choose the web-runtime folder')
    store = FieldStore(state_dir / 'bridge.sqlite', api or None)
    bridge = Bridge(store, api, key, os.environ.get('BRIDGE_TOKEN', ''), capture_only=not args.forward)
    server = None
    workers = []
    try:
        server = ThreadingHTTPServer((args.host, args.port),
                                     make_field_handler(bridge, secrets.token_hex(24)))
        server.daemon_threads = True
        if args.forward:
            worker = threading.Thread(target=bridge.sender, daemon=True)
            worker.start()
            workers.append(worker)
        if args.serial:
            worker = threading.Thread(target=serial_reader, args=(bridge, args.serial), daemon=True)
            worker.start()
            workers.append(worker)
        info = {'service': SERVICE, 'pid': os.getpid(), 'port': args.port,
                'mode': 'forwarding' if args.forward else 'capture_only',
                'url': 'http://127.0.0.1:%d/' % args.port}
        (state_dir / 'service.json').write_text(json.dumps(info), encoding='utf-8')
        if os.name == 'nt':
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000003)
        print('[field-monitor] ' + info['url'], flush=True)
        print('[field-monitor] ' + ('Forwarding to ' + api if args.forward else 'Local capture only.'), flush=True)
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        bridge.stop.set()
        if server is not None:
            server.server_close()
        for worker in workers:
            worker.join(timeout=15)
        store.close()
        if os.name == 'nt':
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)


if __name__ == '__main__':
    main()
