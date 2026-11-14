# AGENTS.md (Codex 등 코딩 에이전트용)

프로젝트 규칙과 실행 방법은 [CLAUDE.md](CLAUDE.md)와 같다. 먼저 읽을 것:
- 전체 기획·ERD·API: `docs/기획문서.md`
- 센서 작업(박서빈 담당): `docs/하드웨어_전달_박서빈.md`

## 센서(sensor/) 작업 범위
- 수정 대상: `sensor/stm32_entry/*.ino`, `sensor/pico_exit/main.py`. 핀 번호, `BROKEN` 논리값, 디바운스·타임아웃만 실측에 맞게 바꾼다.
- **바꾸지 않는 약속**: STM32는 USB 시리얼 115200bps로 차 1대 통과마다 `IN\n` 한 줄. Pico는 `POST http://<노트북IP>:9000/event` 에 `{"deviceId":"exit-pico","direction":"OUT"}`.
  일련번호·재전송·서버 전송은 `sensor/bridge.py` 가 한다. 보드에서 서버로 직접 보내지 않는다.
- 장치 ID(`entry-stm32`, `exit-pico`)는 DB 시드(`backend/.../V2__seed_2026_official.sql`)에 등록돼 있다. 바꾸면 백엔드 시드도 같이 바꿔야 하니 바꾸지 말 것.
- `backend/`, `frontend/` 는 다른 팀원이 작업한다. 센서 작업 중에는 건드리지 말 것.

## 확인 방법
```bash
pip install pyserial requests
python sensor/bridge.py --serial COM5      # 'i' Enter = 입차 흉내, 'o' Enter = 출차 흉내
python sensor/simulate.py --count 5 --fast # 보드 없이 서버 반영 확인
```
비밀값(와이파이 비밀번호, SENSOR_KEY)은 커밋하지 않는다. `main.py` 의 WIFI 값은 커밋 전 비워 둔다.
