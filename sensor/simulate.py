"""
센서 없이 입·출차를 흉내 내는 시뮬레이터 (발표 연습·백업 시연용)
  python sensor/simulate.py                 # 3~8초마다 입차 위주로 발생
  python sensor/simulate.py --count 30 --fast
"""
import argparse
import random
import time

import requests


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://127.0.0.1:8787")
    p.add_argument("--key", default="dev-sensor")
    p.add_argument("--count", type=int, default=0, help="0이면 계속")
    p.add_argument("--fast", action="store_true")
    a = p.parse_args()

    base = int(time.time() * 1000)
    n = 0
    while a.count == 0 or n < a.count:
        n += 1
        out = random.random() < 0.25
        ev = {"deviceId": "exit-pico" if out else "entry-stm32", "seq": base + n, "direction": "OUT" if out else "IN"}
        r = requests.post(f"{a.api}/api/sensor/events", json={"events": [ev]},
                          headers={"X-Sensor-Key": a.key}, timeout=5)
        print(n, ev["direction"], r.status_code, r.text[:80])
        time.sleep(0.3 if a.fast else random.uniform(3, 8))


if __name__ == "__main__":
    main()
