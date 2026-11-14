-- 2026-11-12 교통 담당자 통화 녹음(녹음 (5).m4a) 전사 대조 결과 반영 (00:00~14:00 구간)
-- 근거 시각은 녹음 기준 mm:ss

-- 강 건너 부지: "화천대교 건너기 전에 큰 부지 … 강을 건너야 한다는 생각 때문에 이용을 잘 안 하세요" (04:50~05:34)
-- 이름은 직접 언급되지 않음 → 위라리 둔치로 추정. 약 500대는 팀 통화 필기 값.
update parking_lot
   set capacity_source = '팀 통화 필기: 약 500대 (녹음 04:50 "화천대교 쪽 큰 부지", 위라리 둔치로 추정·확인 필요)',
       note = '화천대교 건너편 큰 부지. 셔틀 출발 정류장(화천체육관)과 가까움'
 where code = 'wirari';

-- 이용권 대상: 담당자가 말한 곳은 강 건너 부지뿐 (10:10, 17:13~18:24 "네")
update parking_lot
   set incentive = false,
       note = '팀 제안: 이용권 확대 후보 (담당자 확인 전)'
 where code in ('silver-center', 'old-mp');

-- 화천초: "160면" (09:57). 2027 축제 사용 여부는 녹음상 불명확
update parking_lot
   set capacity_source = '인터뷰: 160면 (녹음 09:57)',
       note = '축제장과 가장 가까움 · 2027 축제 사용 여부 확인 필요'
 where code = 'hwacheon-elem';

-- 이용권 종류: "눈썰매나 이런 프로그램들, 낚시는 제외하고, 기타 놀거리들, 두 번 탈 수 있는 정도" (10:20~11:05) — 검토 중
update benefit
   set name = '체험 프로그램 무료이용권',
       description = '눈썰매 등 체험 프로그램 2회 (낚시 제외)',
       is_example = true
 where id = (select min(id) from benefit);
