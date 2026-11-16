# 하드웨어 코드 작업 기준

이 폴더는 박서빈이 실제 STM32·Pico에 설치하고 노트북에서 실행한 하드웨어 구현이다.
사용자가 팀 공유를 요청하여 기존 예시 sensor/를 덮어쓰지 않고 별도로 추가했다.
상위 문서의 구형 `IN\n`·ID 없는 OUT 예시 대신 이 폴더 README의 protocol 3·eventId 규격을 따른다.

- STM32: D2/PA10=A, D3/PB3=B, 115200bps, session+seq, 저장 후 ACK.
- Pico: GP14=A, GP15=B, 같은 eventId로 HTTP 재전송, 노트북 저장 후 HTTP 204.
- 브리지→서버: 기존 `/api/sensor/events`, `X-Sensor-Key`, deviceId·seq·direction·occurredAt 유지.
- backend/·frontend/ 코드는 이 폴더 작업에서 변경하지 않는다.
- config.py, runtime/, field-runtime/, web-runtime/, .local/, .venv/는 공유하지 않는다.
- 실제 실행 프로그램에 가짜 통과 생성 기능을 넣지 않는다. 격리된 테스트의 고정 입력과 실물 결과를 구분한다.
- 실행 중인 노트북에서 보드 재설치·서버 전환 전에는 미전송 기록과 센서 통과 중단을 확인한다.
- 검사: `python -m unittest discover -s hardware/sensor/tests -v` (저장소 루트).
