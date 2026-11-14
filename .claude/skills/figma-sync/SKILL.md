---
name: figma-sync
description: 화면(frontend) 또는 DB 스키마(backend Flyway)가 바뀌었을 때 Figma 「ParkingMate 프론트 디자인」·「ParkingMate ERD」 파일을 코드와 맞추는 절차.
---

# Figma 동기화

파일
- 프론트 디자인: https://www.figma.com/design/pqUTvmATB8yWEhsI2yHtoW  (fileKey `pqUTvmATB8yWEhsI2yHtoW`)
- ERD: https://www.figma.com/design/JbMKoXL7MYngDLJsXhIcVk  (fileKey `JbMKoXL7MYngDLJsXhIcVk`)

기준은 항상 **코드**다. Figma를 고친 뒤 코드를 맞추는 게 아니라, 코드가 바뀌면 Figma를 갱신한다.

## 화면이 바뀌었을 때
1. 로컬 실행(백엔드 8787, 프론트 5173) + `python tools/demo_setup.py`.
2. Figma MCP: `create_session`(프론트 fileKey) → Figma 스킬(`get_figma_skill` / figma-use) 확인.
3. 바뀐 화면만 프레임 갱신: 홈 `/`, 주차장 QR 화면 `/p/wirari`, 이용권 `/v/...`, 셔틀 `/shuttle`, 관리 `/admin`, QR 안내판(인쇄).
   프레임 이름은 `01 홈 현황판` 처럼 번호+화면명, 390×844 기준.
4. 페이지 맨 앞 "변경 기록" 프레임에 날짜·바뀐 점 한 줄 추가.

## 스키마가 바뀌었을 때
1. `backend/src/main/resources/db/migration/*.sql` 최신 상태를 읽는다.
2. ERD 파일에서 테이블 박스(컬럼명·타입·PK/FK/UK 표시)와 관계선을 갱신한다.
3. `docs/기획문서.md` 의 ERD 표도 같이 고친다.
