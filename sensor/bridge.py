"""
노트북 센서 브리지
  - 입구 STM32: USB 시리얼로 한 줄씩 "IN" / "OUT" 을 보낸다.
  - 출구 Pico 2 WH: Wi-Fi로 이 브리지에 HTTP POST (/event) 한다.
  - 브리지는 장치별 일련번호(seq)를 붙여 백엔드 /api/sensor/events 로 보낸다.
  - 인터넷이 끊기면 queue.jsonl 에 쌓아 두었다가 다시 보낸다. 같은 seq는 서버가 한 번만 센다.

실행 예)
  pip install pyserial requests
  python sensor/bridge.py --api http://127.0.0.1:8787 --key dev-sensor --serial COM5
  (시리얼 없이 Pico만: --serial 생략)
"""
import argparse
import json
import os
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "bridge_state.json")
QUEUE = os.path.join(HERE, "queue.jsonl")

lock = threading.Lock()


def load_state():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


state = load_state()


def next_seq(device):
    with lock:
        # 브리지를 다시 켜도 seq가 겹치지 않도록 파일에 저장
        state[device] = max(state.get(device, 0) + 1, int(time.time()))
        with open(STATE, "w", encoding="utf-8") as f:
            json.dump(state, f)
        return state[device]


def enqueue(device, direction):
    direction = direction.strip().upper()
    if direction not in ("IN", "OUT"):
        print(f"[무시] {device}: {direction!r}")
        return
    ev = {
        "deviceId": device,
        "seq": next_seq(device),
        "direction": direction,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
    }
    with lock:
        with open(QUEUE, "a", encoding="utf-8") as f:
            f.write(json.dumps(ev) + "\n")
    print(f"[{datetime.now():%H:%M:%S}] {device} {'입차' if direction == 'IN' else '출차'} (seq {ev['seq']})")


def sender(api, key, devices):
    last_beat = 0.0
    while True:
        with lock:
            try:
                with open(QUEUE, encoding="utf-8") as f:
                    pending = [json.loads(line) for line in f if line.strip()]
            except FileNotFoundError:
                pending = []
        if pending:
            try:
                r = requests.post(f"{api}/api/sensor/events", json={"events": pending[:50]},
                                  headers={"X-Sensor-Key": key}, timeout=5)
                if r.ok:
                    res = r.json()
                    print(f"  → 서버 반영 {res['accepted']}건, 중복 {res['duplicates']}건 {res['errors'] or ''}")
                    with lock:
                        with open(QUEUE, encoding="utf-8") as f:
                            rest = [line for line in f if line.strip()][len(pending[:50]):]
                        with open(QUEUE, "w", encoding="utf-8") as f:
                            f.writelines(rest)
                else:
                    print(f"  ! 서버 거부 {r.status_code}: {r.text[:120]}")
                    time.sleep(3)
            except requests.RequestException as e:
                print(f"  ! 전송 실패(대기 {len(pending)}건, 다시 시도): {e.__class__.__name__}")
                time.sleep(3)
        if time.time() - last_beat > 30:
            for d in devices:
                try:
                    requests.post(f"{api}/api/sensor/heartbeat", json={"deviceId": d},
                                  headers={"X-Sensor-Key": key}, timeout=5)
                except requests.RequestException:
                    pass
            last_beat = time.time()
        time.sleep(0.5)


def serial_reader(port, device):
    import serial  # pyserial

    while True:
        try:
            with serial.Serial(port, 115200, timeout=1) as s:
                print(f"[시리얼] {port} 연결 ({device})")
                while True:
                    line = s.readline().decode(errors="ignore").strip()
                    if line:
                        enqueue(device, line.split(",")[0])
        except Exception as e:  # 케이블 빠짐 등
            print(f"[시리얼] {port} 끊김: {e}. 3초 후 재연결")
            time.sleep(3)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/event":
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode(errors="ignore")
        try:
            data = json.loads(body)
            enqueue(data.get("deviceId", "exit-pico"), data["direction"])
        except (json.JSONDecodeError, KeyError, TypeError):
            enqueue("exit-pico", body)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://127.0.0.1:8787")
    p.add_argument("--key", default=os.environ.get("SENSOR_KEY", "dev-sensor"))
    p.add_argument("--serial", help="STM32 시리얼 포트 (예: COM5)")
    p.add_argument("--entry-device", default="entry-stm32")
    p.add_argument("--http-port", type=int, default=9000)
    a = p.parse_args()

    devices = ["exit-pico"]
    if a.serial:
        devices.append(a.entry_device)
        threading.Thread(target=serial_reader, args=(a.serial, a.entry_device), daemon=True).start()
    threading.Thread(target=sender, args=(a.api.rstrip("/"), a.key, devices), daemon=True).start()
    print(f"[브리지] Pico 수신 대기: http://0.0.0.0:{a.http_port}/event  →  서버 {a.api}")
    print("[브리지] 키보드 테스트: i = 입차, o = 출차 (Enter)")

    srv = ThreadingHTTPServer(("0.0.0.0", a.http_port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        while True:
            cmd = input().strip().lower()
            if cmd == "i":
                enqueue(a.entry_device, "IN")
            elif cmd == "o":
                enqueue("exit-pico", "OUT")
    except (KeyboardInterrupt, EOFError):
        while True:  # 입력 없는 환경에서도 계속 동작
            time.sleep(3600)


if __name__ == "__main__":
    main()
