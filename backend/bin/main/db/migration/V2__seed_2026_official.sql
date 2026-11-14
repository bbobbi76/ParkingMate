-- 출처: 재단법인 나라 2026 산천어축제 「임시 주차장 안내」 배치도 (narafestival.com/01_icenara/?wr_id=151)
--       「축제장 외부 주말 셔틀」 (narafestival.com/01_icenara/?wr_id=121), 2026-11-15 확인
-- 좌표: 'OSM' = OpenStreetMap 건물 위치, '배치도 근사' = 공식 배치도(비축척)에서 추정, 오차 약 150m
-- 면수: 인터뷰(2026-11-12 교통 담당자) 값 외에는 null(미확인)

insert into parking_lot (code, name, category, lat, lng, coord_source, capacity, capacity_source, incentive, sensor_enabled, shuttle_stop, note, data_source, sort_order, updated_at) values
('wirari',        '위라리 둔치 임시주차장',        'REMOTE',     38.09900, 127.70400, '배치도 근사(화천체육관 인근)',  500,  '인터뷰: 강 건너 부지 약 500대(위라리 둔치로 추정, 확인 필요)', true,  true,  '화천체육관',     '강 건너편. 셔틀 출발 정류장(화천체육관)과 가까움', '나라 2026 임시주차장 안내', 1, current_timestamp),
('silver-center', '실버복지센터 임시주차장',       'REMOTE',     38.11431, 127.70339, '배치도 근사',                  null, null, true,  false, '화천실버복지센터', null, '나라 2026 임시주차장 안내', 2, current_timestamp),
('old-mp',        '구 헌병대 부지 임시주차장',     'REMOTE',     38.11124, 127.70437, '배치도 근사',                  null, null, true,  false, '구 헌병대',       null, '나라 2026 임시주차장 안내', 3, current_timestamp),
('info-hs',       '정보산업고등학교 임시주차장',   'SHUTTLE',    38.10731, 127.70443, 'OSM(화천정보산업고등학교)',     null, null, false, false, '정보산업고',      '2026년 대형버스 주차 안내(민간 블로그, 확인 필요)', '나라 2026 임시주차장 안내', 4, current_timestamp),
('nara',          '재단법인 나라 임시주차장',      'NEAR',       38.11200, 127.70964, '배치도 근사',                  null, null, false, false, null,              null, '나라 2026 임시주차장 안내', 5, current_timestamp),
('jeil-church',   '화천제일교회 임시주차장',       'NEAR',       38.11142, 127.71025, 'OSM(화천제일감리교회)',         null, null, false, false, null,              null, '나라 2026 임시주차장 안내', 6, current_timestamp),
('jjukkumi',      '그집쭈꾸미 앞 부지 임시주차장', 'NEAR',       38.10931, 127.70782, '배치도 근사',                  null, null, false, false, null,              null, '나라 2026 임시주차장 안내', 7, current_timestamp),
('health-ok',     '보건의료원~OK공업사 임시주차장','NEAR',       38.10730, 127.70906, 'OSM(화천군보건의료원 건물 기준)', null, null, false, false, null,             null, '나라 2026 임시주차장 안내', 8, current_timestamp),
('youth-center',  '청소년수련관 임시주차장',       'NEAR',       38.10786, 127.71122, '배치도 근사',                  null, null, false, false, '청소년 수련관',   '청소년수련관 내 캠핑카·카라반 출입 통제', '나라 2026 임시주차장 안내', 9, current_timestamp),
('hwacheon-elem', '화천초등학교 임시주차장',       'NEAR',       38.10534, 127.70900, 'OSM(화천초등학교)',             160,  '인터뷰: 약 160대', false, false, null, '축제장과 가장 가까움', '나라 2026 임시주차장 안내', 10, current_timestamp),
('dessian-acc',   '데시앙 앞 장애인 전용 주차장',  'ACCESSIBLE', 38.11242, 127.70584, 'OSM(화천상리데시앙아파트 기준)', null, null, false, false, null,             '장애인 전용', '나라 2026 임시주차장 안내', 11, current_timestamp),
('tunnel3',       '제3터널 둔치 캠핑카·카라반 주차장', 'CAMPING', 38.10266, 127.70617, '배치도 근사',                  null, null, false, false, null,              '캠핑카·카라반 전용', '나라 2026 임시주차장 안내', 12, current_timestamp);

insert into sensor_device (device_id, lot_id, gate) values
('entry-stm32', (select id from parking_lot where code = 'wirari'), 'ENTRY'),
('exit-pico',   (select id from parking_lot where code = 'wirari'), 'EXIT');

insert into benefit (name, description, active, is_example) values
-- 종류·수량은 담당자 협의 후 확정 (is_example = true 동안 화면에 '예시' 표시)
('체험 프로그램 무료이용권', '눈썰매 등 체험 프로그램 1회', true, true);

insert into shuttle_route (name, days, first_departure, last_departure, interval_minutes, bus_count, source) values
('축제장 외부 주말 셔틀', 'SAT,SUN', '09:00', '18:00', 20, 4, '나라 2026 축제장 외부 주말 셔틀 (2027 업데이트 예정)');

insert into shuttle_stop (route_id, seq, name, lat, lng, offset_minutes, offset_source, coord_source) values
((select id from shuttle_route), 1, '화천체육관',       38.09846, 127.70587,  0, '출발 정류장', 'OSM'),
((select id from shuttle_route), 2, '청소년 수련관',    38.10786, 127.71122, 10, '추정(정류장 간 10분)', '배치도 근사'),
((select id from shuttle_route), 3, '화천실버복지센터', 38.11431, 127.70339, 20, '추정(정류장 간 10분)', '배치도 근사'),
((select id from shuttle_route), 4, '구 헌병대',        38.11124, 127.70437, 30, '추정(정류장 간 10분)', '배치도 근사'),
((select id from shuttle_route), 5, '정보산업고',       38.10731, 127.70443, 40, '추정(정류장 간 10분)', 'OSM'),
((select id from shuttle_route), 6, '시외버스터미널',   38.10447, 127.70433, 50, '추정(정류장 간 10분)', 'OSM(화천공용버스터미널)'),
((select id from shuttle_route), 7, '배수펌프장',       38.10200, 127.70800, 60, '추정(정류장 간 10분)', '위치 미확인(근사)');
