# ParkingMate — 화천 주차·셔틀 안내

지역문제 해결 프로젝트입니다 (KNU RE:RISE).

화천 산천어축제 임시주차장의 **남은 자리**를 입·출구 센서로 세어 실시간으로 보여 주고, 셔틀 시간·예상 위치와 축제장 안내 지도를 함께 제공해 방문객이 여유 있는 주차장으로 나눠 가도록 돕습니다.
(2026-11-16 팀 결정: 이용권 발급·QR 기능은 빼고, 먼 주차장 이용권은 화천군이 지급하는 것으로 안내만 표시합니다.)
2026-11-12 화천군 교통 담당자 인터뷰를 바탕으로 방향을 정했습니다. 자세한 내용은 [기획문서](docs/기획문서.md)에 있습니다.

| 화면 | 주소 |
|---|---|
| 임시주차장 현황(지도·목록) | `/` |
| 주차장 상세(남은 자리·셔틀·길찾기) | `/p/{주차장코드}` |
| 셔틀(노선 지도, 버스 예상 위치, 정류장별 다음 셔틀까지 남은 분, 축제장까지 걸리는 시간) | `/shuttle` |
| 축제장 안내(낚시터·체험장·먹거리·접수처 지도) | `/festival` |
| 현장 관리(직원: 차량 수·운영 가능 면수·상태, 센서 기록, 축제장 장소 추가·수정) | `/admin` |

## 구성
```
[입구 적외선 A·B] → STM32 ─USB─┐
                               ├→ sensor/bridge.py ─JSON→ Spring Boot(backend) ─ PostgreSQL
[출구 적외선 A·B] → Pico 2 WH ─Wi-Fi┘                          ↑
                                                React(frontend) ┘
```
- `backend/` Spring Boot 4, Java 21, Flyway. 로컬은 H2, 배포는 PostgreSQL(Neon).
- `frontend/` React + Vite. 카카오맵(키 없으면 OpenStreetMap).
- `sensor/` 노트북 브리지, 시뮬레이터, STM32·Pico 펌웨어 예시.

## 실물 하드웨어 코드 · 박서빈

STM32 입구·Pico 2 WH 출구의 실제 사용 코드, 노트북 카운터, 서버 주소·센서 키를 입력하는 웹 연결 도구는 **[hardware/](hardware/README.md)** 에 정리했습니다. 새 보드 프로그램은 해당 폴더의 브리지와 함께 사용합니다. 첫 설치는 `hardware/setup.cmd`, 현장 카운터는 `hardware/현장테스트_시작.cmd`, 배포 웹 연결은 `hardware/웹연결_시작.cmd`로 실행합니다.

설치 방법·핀·통신 규격·검증 범위는 [하드웨어 README](hardware/README.md), 웹/서버 담당자가 맞출 내용은 [전달사항](hardware/웹담당자_전달사항.txt)을 참고하세요. 실제 센서 키, Wi-Fi 비밀번호, 테스트 DB·로그는 포함하지 않았습니다.

## 로컬 실행
```bash
cd backend && ./gradlew bootRun --args='--app.demo-clock=2027-01-16T09:30'   # http://localhost:8787
cd frontend && npm install && npm run dev                                   # http://localhost:5173
python tools/demo_setup.py        # 시연용: 축제 토요일 오전 상황 입력
python sensor/simulate.py         # 센서 없이 입·출차 흉내
```
관리 화면 기본 키(로컬 전용): `dev-admin`. 배포 시 환경 변수 `ADMIN_KEY`, `SENSOR_KEY`로 바꿉니다.

## 데이터 출처
- 임시주차장 이름·배치, 주말 셔틀 노선·운행시간: 재단법인 나라 2026 산천어축제 안내 (2027 업데이트 예정)
- 좌표: OpenStreetMap 건물 위치, 없는 곳은 공식 배치도 근사(±150m) — 카카오 로컬 API로 보정 예정
- 면수: 인터뷰 값(화천초 약 160대, 강 건너 부지 약 500대) 외에는 미확인 → 화면에 "정보없음"
- 셔틀 정류장별 시각·버스 위치는 시간표로 계산한 추정값이며(실시간 GPS 아님) 화면에 표시합니다.
- 축제장 장소·체험료: 재단법인 나라 2026 행사장 안내도·체험료. 위치는 안내도를 OSM 건물에 맞춘 근사값(약 100m).
