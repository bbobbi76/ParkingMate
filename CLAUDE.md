# 화천 Parking Mate — 작업 규칙

KNU RE:RISE 7팀. 축제 임시주차장 남은 자리 표시 + 먼 주차장 주차 시 무료이용권 발급. 상세 기획·ERD·API: `docs/기획문서.md`.
마감: 2026-11-17(화) 웹·센서·시연·PPT, 발표 2026-11-21(토) 화천군청 멘토 대상.

## 구조
- `backend/` Spring Boot 4 · Java 21 · Gradle. 패키지 `kr.parkingmate.{lot,sensor,shuttle,voucher,common}`. DB 스키마/시드는 Flyway `src/main/resources/db/migration`.
- `frontend/` React + Vite. 페이지 `src/pages`, API 호출 `src/api.js`.
- `sensor/` 노트북 브리지(STM32 시리얼·Pico HTTP → 백엔드 JSON), 시뮬레이터.

## 명령
- 백엔드 실행(로컬 H2, DB 설치 불필요): `cd backend && ./gradlew bootRun` → http://localhost:8787
- 백엔드 테스트: `cd backend && ./gradlew test`
- 프론트: `cd frontend && npm install && npm run dev` → http://localhost:5173
- 센서 시뮬레이터: `python sensor/simulate.py --count 5 --fast` (위라리 둔치 센서로 전송)
- 시연 상황 입력: `python tools/demo_setup.py` (배포 서버: `--api https://parkingmate-api.onrender.com`)
- 배포: 웹 https://parking-mate.vercel.app (Vercel) · 서버 https://parkingmate-api.onrender.com (Render, Swagger `/swagger-ui.html`) · DB Neon. main 에 push 하면 둘 다 자동 배포

## 원칙
- 데이터는 실제 출처 기반. 추정·예시 값은 `*_source` 컬럼과 화면 문구로 반드시 구분. 없는 면수는 지어내지 말고 null.
- 서비스 이름은 "화천축제 주차안내"처럼 하는 일이 바로 보이게. 팀명은 앞에 내세우지 않음. 화천군·산천어축제 공식 로고/브랜딩 사용 금지.
- 이용자 대부분 50대 이상, 보는 사람은 화천군 교통 담당 공무원. 정부 서비스(KRDS) 느낌: Pretendard, 남색 기본색, 본문 19px 이상, 버튼 높이 52px 이상, 상태는 색+글자 함께.
- AI가 만든 티 금지: 그라데이션·이모지·그림자 카드·장식 아이콘·영문 슬로건 쓰지 않음. 큰 숫자(남은 자리·셔틀 시각) 우선, 한 화면 한 가지 일.
- 시연: 백엔드 `DEMO_CLOCK=2027-01-16T09:30` 으로 축제 토요일 시각부터 흐르게 실행.
- 비밀값(ADMIN_KEY, SENSOR_KEY, DB 비밀번호, 카카오 키)은 `.env`/환경 변수에만. 커밋 금지.
- 같은 센서 이벤트(deviceId+seq)는 한 번만 반영. 이용권은 차량번호당 하루 1장.
