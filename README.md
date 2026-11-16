# ParkingMate — 산천어축제 주차안내

지역문제 해결 프로젝트입니다 (KNU RE:RISE).

화천 산천어축제 임시주차장의 **남은 자리**를 입·출구 센서로 세어 실시간으로 보여 주고, 셔틀 시간과 함께 안내해 방문객이 여유 있는 주차장으로 나눠 가도록 돕습니다.
(2026-11-16 팀 결정으로 QR·무료이용권 기능은 뺐습니다.)
2026-11-12 화천군 교통 담당자 인터뷰를 바탕으로 방향을 정했습니다. 자세한 내용은 [기획문서](docs/기획문서.md)에 있습니다.

| 화면 | 주소 |
|---|---|
| 임시주차장 현황(지도·목록) | `/` |
| 주차장 상세(남은 자리·셔틀·길찾기) | `/p/{주차장코드}` |
| 셔틀 시간표 | `/shuttle` |
| 현장 관리(직원: 차량 수·운영 가능 면수·상태, 센서 기록) | `/admin` |

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
- 셔틀 정류장별 시각은 추정값이며 화면에 표시합니다.
