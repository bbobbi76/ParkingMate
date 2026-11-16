"""Prompt locally; backend SENSOR_KEY never belongs on the Pico."""
import getpass
import ipaddress
from pathlib import Path
from deploy import deploy

ROOT = Path(__file__).resolve().parent

def main():
    print('Pico exit -> laptop bridge :9000, same 2.4 GHz Wi-Fi')
    ssid = input('Wi-Fi name: ').strip()
    password = getpass.getpass('Wi-Fi password (hidden): ')
    host = input('Laptop LAN IPv4: ').strip()
    address = ipaddress.IPv4Address(host)
    if address.is_loopback or address.is_unspecified or address.is_multicast or address.is_reserved:
        raise ValueError('Use the laptop LAN IPv4')
    token = getpass.getpass('Optional BRIDGE_TOKEN (Enter if unset on laptop): ')
    level = input('Measured GPIO level when beam is blocked [0 or 1, default 0]: ').strip() or '0'
    if not ssid or level not in ('0', '1') or not all(33 <= ord(c) <= 126 for c in token):
        raise ValueError('Invalid Wi-Fi name, token or blocked level')
    values = {'WIFI_SSID': ssid, 'WIFI_PASSWORD': password, 'BRIDGE_HOST': host,
              'BRIDGE_PORT': 9000, 'BRIDGE_TOKEN': token, 'PIN_A': 14, 'PIN_B': 15,
              'BLOCKED_LEVEL': int(level), 'DEBOUNCE_MS': 80, 'PASSAGE_TIMEOUT_MS': 30000,
              'MAX_PENDING': 128, 'DEBUG_USB': False}
    destination = ROOT / 'config.py'
    if destination.exists():
        backup = ROOT / '.local/config.previous.py'
        backup.parent.mkdir(exist_ok=True)
        backup.write_bytes(destination.read_bytes())
    destination.write_text('# Private: do not share or commit.\n' +
                           '\n'.join(k + ' = ' + repr(v) for k, v in values.items()) + '\n', encoding='utf-8')
    deploy()
    print('Run sensor/bridge.py on laptop; allow its port 9000 on your private Wi-Fi.')

if __name__ == '__main__':
    main()
