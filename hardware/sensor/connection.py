"""Shared private connection settings for bridge and non-counting API checks."""
import ipaddress
import json
import os
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent

def resolve(api=None, key=None, config_path=None):
    path = Path(config_path) if config_path else HERE/'runtime/connection.json'
    config = json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else {}
    if config_path and not path.exists():
        raise ValueError('Connection config file not found')
    if not isinstance(config, dict):
        raise ValueError('Connection config must be an object')
    base = api or os.environ.get('PARKING_API_URL') or config.get('api') or 'http://127.0.0.1:8787'
    if not isinstance(base, str):
        raise ValueError('Invalid API address')
    base = base.rstrip('/')
    parsed = urlparse(base)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path or any(c in base for c in '\r\n')):
        raise ValueError('Use the backend origin, e.g. http://127.0.0.1:8787 (without /api)')
    local = parsed.hostname == 'localhost'
    try:
        local = local or ipaddress.ip_address(parsed.hostname).is_loopback
    except ValueError:
        pass
    sensor_key = key or os.environ.get('SENSOR_KEY') or config.get('sensor_key') or ('dev-sensor' if local else '')
    if not isinstance(sensor_key, str) or not sensor_key or any(c in sensor_key for c in '\r\n'):
        raise ValueError('Set SENSOR_KEY or private runtime/connection.json; remote servers have no default key')
    return base, sensor_key
