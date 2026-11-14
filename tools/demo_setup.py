"""
시연 상황 만들기: 축제 토요일 오전 (인터뷰: 토요일 8시 30분이면 가까운 주차장 만차).
현장 직원이 관리 화면에서 입력하는 것과 같은 API로 상태를 넣는다. 실측값이 아님.
  python tools/demo_setup.py [--api http://127.0.0.1:8787] [--key dev-admin]
"""
import argparse

import requests

SCENE = {
    "hwacheon-elem": {"currentCount": 160},          # 면수 160 → 만차(자동 계산)
    "youth-center": {"manualStatus": "FULL"},
    "health-ok": {"manualStatus": "FULL"},
    "jjukkumi": {"manualStatus": "FULL"},
    "jeil-church": {"manualStatus": "FULL"},
    "nara": {"manualStatus": "BUSY"},
    "info-hs": {"manualStatus": "BUSY"},
    "dessian-acc": {"manualStatus": "BUSY"},
    "silver-center": {"manualStatus": "AVAILABLE"},
    "old-mp": {"manualStatus": "AVAILABLE"},
    "tunnel3": {"manualStatus": "AVAILABLE"},
    "wirari": {"currentCount": 188, "manualStatus": "AUTO"},  # 센서 집계 주차장, 시연 중 센서로 변함
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://127.0.0.1:8787")
    p.add_argument("--key", default="dev-admin")
    a = p.parse_args()
    for code, body in SCENE.items():
        r = requests.patch(f"{a.api}/api/admin/lots/{code}", json=body, headers={"X-Admin-Key": a.key}, timeout=5)
        d = r.json()
        print(f"{d.get('name', code):<24} {d.get('level')} 남은 {d.get('remaining')}")


if __name__ == "__main__":
    main()
