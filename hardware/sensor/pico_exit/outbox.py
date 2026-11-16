"""Two alternating, hashed snapshots keep pending event identities across reboots."""
import json
import os
import hashlib
import binascii

def digest(payload):
    return binascii.hexlify(hashlib.sha256(payload.encode()).digest()).decode()

def valid_event(event):
    if not isinstance(event, dict):
        return False
    event_id = event.get('eventId', '')
    return (event.get('deviceId') == 'exit-pico' and event.get('direction') == 'OUT'
            and isinstance(event_id, str) and len(event_id) == 32
            and all(c in '0123456789abcdef' for c in event_id))

class Outbox:
    PATHS = ('team-pending-a.json', 'team-pending-b.json')

    def __init__(self, maximum=128):
        self.maximum = maximum
        self.items = []
        self.revision = 0
        self.slot = 1
        self.dropped = 0
        self.faults = 0
        self.hard_fault = False
        self.write_fault = False
        found = 0
        candidates = []
        existing = os.listdir()
        for slot, path in enumerate(self.PATHS):
            if path in existing:
                found += 1
            try:
                with open(path) as file:
                    envelope = json.load(file)
                payload = envelope['payload']
                if digest(payload) != envelope['sha256']:
                    raise ValueError('snapshot checksum')
                state = json.loads(payload)
                items = state['items']
                revision = envelope['revision']
                if (type(revision) is not int or revision < 1 or not isinstance(items, list)
                        or len(items) > maximum or not all(valid_event(e) for e in items)):
                    raise ValueError('snapshot format')
                candidates.append((revision, slot, items, int(state.get('dropped', 0))))
            except OSError:
                pass
            except (ValueError, KeyError, TypeError):
                self.faults += 1
        if candidates:
            newest = max(candidates, key=lambda row: row[0])
            self.revision, self.slot, self.items, self.dropped = newest
        elif found:
            # Keep the damaged files: a new empty queue must not mask lost events.
            self.hard_fault = True

    def save(self):
        if self.hard_fault:
            return False
        next_slot = 1 - self.slot
        payload = json.dumps({'items': self.items, 'dropped': self.dropped})
        envelope = {'revision': self.revision + 1, 'payload': payload, 'sha256': digest(payload)}
        try:
            # Only overwrite the older snapshot; the last valid one stays intact.
            with open(self.PATHS[next_slot], 'w') as file:
                json.dump(envelope, file)
            os.sync()
        except OSError:
            self.faults += 1
            self.write_fault = True
            return False
        self.slot = next_slot
        self.revision += 1
        self.write_fault = False
        return True

    def append(self, event):
        if self.hard_fault or len(self.items) >= self.maximum:
            self.dropped += 1
            return False
        self.items.append(event)
        self.save()
        return True

    def acknowledge(self, event):
        if not self.items or self.items[0] is not event:
            return
        self.items.pop(0)
        if not self.save():
            self.items.insert(0, event)
