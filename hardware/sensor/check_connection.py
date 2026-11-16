"""Validate the team API/key with an EMPTY batch; never generate a vehicle or heartbeat."""
import argparse
import json
import requests
from connection import resolve

def check(api, key):
    response = requests.get(api+'/api/lots/wirari', timeout=(5,20))
    response.raise_for_status()
    lot = response.json()
    if lot.get('code') != 'wirari' or lot.get('sensorEnabled') is not True:
        raise ValueError('wirari is missing or sensors are disabled')
    response = requests.post(api+'/api/sensor/events', json={'events':[]},
                             headers={'X-Sensor-Key':key}, timeout=(5,20), allow_redirects=False)
    if response.status_code != 200 or response.json() != {'accepted':0,'duplicates':0,'errors':[]}:
        raise ValueError('Sensor authentication/API contract not confirmed (HTTP %d)' % response.status_code)
    return {'api':api,'lot':lot['code'],'sensor_authentication':'confirmed',
            'currentCount':lot.get('currentCount'),'remaining':lot.get('remaining'),
            'vehicle_events_sent':0,'physical_initial_count_verified':False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--api'); parser.add_argument('--config')
    args=parser.parse_args()
    api,key=resolve(args.api,config_path=args.config)
    print(json.dumps(check(api,key),ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
