"""Write a private laptop config, asking for the server key without echo."""
import getpass
import json
from pathlib import Path
from connection import resolve

def main():
    api = input('Backend origin [http://127.0.0.1:8787]: ').strip() or 'http://127.0.0.1:8787'
    key = getpass.getpass('SENSOR_KEY (hidden; Enter only for local dev-sensor): ')
    # Explicit values are resolved without reading an existing private config.
    from tempfile import TemporaryDirectory
    with TemporaryDirectory() as temporary:
        blank = Path(temporary)/'blank.json'; blank.write_text('{}', encoding='utf-8')
        api, key = resolve(api, key, blank)
    folder = Path(__file__).resolve().parent/'runtime'
    folder.mkdir(exist_ok=True)
    target = folder/'connection.json'
    temporary = folder/'connection.json.tmp'
    temporary.write_text(json.dumps({'api':api,'sensor_key':key},indent=2)+'\n',encoding='utf-8')
    temporary.replace(target)
    print('Private connection settings saved. No events sent.')

if __name__ == '__main__':
    main()
