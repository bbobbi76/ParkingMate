"""Durable receipt, source-ID deduplication and backend sequence allocation."""
import json
import re
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

DEVICES = {'entry-stm32': 'IN', 'exit-pico': 'OUT'}


def validate(device, direction, event_id=None):
    if device not in DEVICES or direction != DEVICES[device]:
        raise ValueError('Unknown device or wrong gate direction')
    if event_id is not None and (not isinstance(event_id, str)
            or not re.fullmatch(r'[A-Za-z0-9._:-]{1,96}', event_id)):
        raise ValueError('Invalid eventId')


class Store:
    def __init__(self, path, api=None):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, timeout=10, check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS sequence (device TEXT PRIMARY KEY, value INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY, device TEXT NOT NULL, source_id TEXT,
            seq INTEGER NOT NULL, body TEXT NOT NULL,
            delivered INTEGER NOT NULL DEFAULT 0, error TEXT,
            UNIQUE(device, source_id), UNIQUE(device, seq));
        ''')
        if api:
            previous = self.db.execute("SELECT value FROM meta WHERE name='api'").fetchone()
            if previous and previous[0] != api:
                self.db.close()
                raise ValueError('This database belongs to another API; choose a separate --state-dir')
            with self.db:
                self.db.execute("INSERT OR IGNORE INTO meta VALUES('api', ?)", (api,))

    def enqueue(self, device, direction, event_id=None):
        validate(device, direction, event_id)
        with self.lock, self.db:
            if event_id is not None:
                previous = self.db.execute('SELECT seq FROM events WHERE device=? AND source_id=?',
                                           (device, event_id)).fetchone()
                if previous:
                    return previous[0], False
            row = self.db.execute('SELECT value FROM sequence WHERE device=?', (device,)).fetchone()
            seq = max((row[0] if row else 0) + 1, time.time_ns() // 1_000_000)
            body = {'deviceId': device, 'seq': seq, 'direction': direction,
                    'occurredAt': datetime.now(timezone.utc).isoformat()}
            self.db.execute('INSERT INTO events(device, source_id, seq, body) VALUES(?,?,?,?)',
                            (device, event_id, seq, json.dumps(body)))
            self.db.execute('INSERT INTO sequence VALUES(?,?) ON CONFLICT(device) DO UPDATE SET value=excluded.value',
                            (device, seq))
        # The transaction has committed before the caller sends HTTP 204.
        return seq, True

    def pending(self):
        with self.lock:
            row = self.db.execute('SELECT id,body FROM events WHERE delivered=0 ORDER BY id LIMIT 1').fetchone()
            return (row[0], json.loads(row[1])) if row else None

    def delivered(self, row_id):
        with self.lock, self.db:
            self.db.execute('UPDATE events SET delivered=1,error=NULL WHERE id=?', (row_id,))

    def failed(self, row_id, message):
        with self.lock, self.db:
            self.db.execute('UPDATE events SET error=? WHERE id=?', (message[:500], row_id))

    def counts(self):
        with self.lock:
            return dict(self.db.execute('SELECT delivered,count(*) FROM events GROUP BY delivered'))

    def import_legacy(self, folder):
        """Import old seq/JSONL files atomically once; never erase the originals."""
        folder = Path(folder)
        with self.lock, self.db:
            if self.db.execute("SELECT 1 FROM meta WHERE name='legacy_imported'").fetchone():
                return
            sequence_path, queue_path = folder / 'bridge_state.json', folder / 'queue.jsonl'
            old_seq = json.loads(sequence_path.read_text(encoding='utf-8-sig')) if sequence_path.exists() else {}
            old_events = [json.loads(line) for line in queue_path.read_text(encoding='utf-8-sig').splitlines()
                          if line.strip()] if queue_path.exists() else []
            if not isinstance(old_seq, dict):
                raise ValueError('Invalid legacy bridge_state.json; original preserved')
            for device, seq in old_seq.items():
                if device not in DEVICES or type(seq) is not int or seq < 0 or seq > 2**53 - 1:
                    raise ValueError('Invalid legacy sequence; original preserved')
                self.db.execute('INSERT INTO sequence VALUES(?,?) ON CONFLICT(device) DO UPDATE SET value=max(value,excluded.value)',
                                (device, seq))
            for event in old_events:
                if not isinstance(event, dict):
                    raise ValueError('Invalid legacy queue row; original preserved')
                validate(event.get('deviceId'), event.get('direction'))
                seq, device = event.get('seq'), event['deviceId']
                if type(seq) is not int or not 0 < seq <= 2**53 - 1:
                    raise ValueError('Invalid legacy queue sequence; original preserved')
                existing = self.db.execute('SELECT body FROM events WHERE device=? AND seq=?', (device, seq)).fetchone()
                if existing:
                    if json.loads(existing[0]) != event:
                        raise ValueError('Conflicting legacy sequence; original preserved')
                else:
                    self.db.execute('INSERT INTO events(device,source_id,seq,body) VALUES(?,?,?,?)',
                                    (device, 'legacy-import:' + str(seq), seq, json.dumps(event)))
                self.db.execute('INSERT INTO sequence VALUES(?,?) ON CONFLICT(device) DO UPDATE SET value=max(value,excluded.value)',
                                (device, seq))
            self.db.execute("INSERT INTO meta VALUES('legacy_imported','yes')")

    def close(self):
        with self.lock:
            self.db.close()
