"""Upload only the exit-controller files to one verified Pico 2 W."""
import argparse
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from serial.tools import list_ports

ROOT = Path(__file__).resolve().parent
FILES = ('gate.py', 'outbox.py', 'link.py', 'config.py', 'main.py')

def remote(port, *commands, capture=False):
    result = subprocess.run([sys.executable, '-m', 'mpremote', 'connect', port, *commands],
                            capture_output=True, text=True, encoding='utf-8', timeout=60)
    if result.returncode:
        # Do not echo command arguments: future configuration may contain secrets.
        raise RuntimeError(result.stderr.strip() or 'Pico upload failed')
    if capture:
        return result.stdout
    return ''

def select_port(requested=None):
    candidates = [p for p in list_ports.comports() if p.vid == 0x2E8A and p.pid != 0x000F]
    if requested:
        if not any(p.device == requested for p in candidates):
            raise RuntimeError('The selected port is not a running Raspberry Pi USB device.')
        return requested
    if len(candidates) != 1:
        raise RuntimeError('Connect exactly one Pico 2 WH by USB, or specify --port.')
    return candidates[0].device

def deploy(port=None):
    # Syntax errors are caught before stopping the existing board program.
    for name in FILES:
        compile((ROOT / name).read_text(encoding='utf-8-sig'), name, 'exec')
    port = select_port(port)
    backup = ROOT / '.local' / 'backup' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    changed = False
    verified = False
    original_names = []
    try:
        identity = remote(port, 'exec', 'import sys; print(sys.implementation._machine)', capture=True).strip()
        verified = True
        if 'Pico 2 W' not in identity or 'RP2350' not in identity:
            raise RuntimeError('Install the official RPI_PICO2_W MicroPython firmware first.')
        original_names = json.loads(remote(port, 'exec', 'import os,json; print(json.dumps(os.listdir()))', capture=True).strip())
        remote(port, 'exec', "import os,json\nfor n in ('pending.json','pending-a.json','pending-b.json'):\n if n in os.listdir():\n  with open(n) as f: d=json.load(f)\n  items=d if isinstance(d,list) else json.loads(d['payload'])['items']\n  if items: raise ValueError('Old pending queue requires migration before upgrade')")
        for name in FILES + ('team-pending-a.json', 'team-pending-b.json', 'pending.json', 'pending-a.json', 'pending-b.json'):
            if name in original_names:
                backup.mkdir(parents=True, exist_ok=True)
                remote(port, 'fs', 'cp', ':' + name, str(backup / name))
        # Stage and compile on MicroPython before replacing runnable files.
        args = []
        for name in FILES:
            args += ['fs', 'cp', str(ROOT / name), ':' + name + '.new', '+']
        remote(port, *args)
        remote(port, 'exec', "for n in ('gate.py','outbox.py','link.py','config.py','main.py'):\n with open(n+'.new') as f: compile(f.read(),n,'exec')")
        changed = True
        remote(port, 'exec', "import os\nfor n in ('gate.py','outbox.py','link.py','config.py','main.py'):\n os.rename(n+'.new',n)\nos.sync()")
        record = {
            'board': identity, 'port': port, 'program': 'pico-exit-team-v3',
            'uploaded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'files': {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in FILES if n != 'config.py'},
            'configuration_uploaded': True, 'sensor_passages_verified': False,
        }
        (ROOT / '.local').mkdir(exist_ok=True)
        (ROOT / '.local/deployment.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    except Exception:
        if changed:
            # Best-effort restore; backup remains available if USB was disconnected.
            try:
                for name in FILES:
                    if (backup / name).exists():
                        remote(port, 'fs', 'cp', str(backup / name), ':' + name)
            except Exception:
                print('Restore incomplete: reconnect USB and restore files from ' + str(backup))
        raise
    finally:
        if verified:
            try:
                remote(port, 'reset')
            except Exception:
                print('USB reset unavailable; reconnect power after checking upload result.')
    print('Pico team program installed on ' + port + '. Private values were not printed.')
    return port

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port')
    deploy(parser.parse_args().port)
