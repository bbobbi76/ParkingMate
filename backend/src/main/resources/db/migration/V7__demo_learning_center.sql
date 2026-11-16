-- 2026-11-17 발표·시연 장소: 화천평생학습관(강원특별자치도 화천군 화천읍 산천어길 91) 주차장을 50면으로 두고
-- 입구·출구 센서를 여기에 연결한다. 차 들어오면 남은 자리 49, 나가면 50.
-- 위라리 둔치의 sensor_enabled 는 하드웨어 연결 확인(GET /api/lots/wirari)이 true 를 보므로 그대로 둔다.
insert into parking_lot (code, name, category, lat, lng, coord_source, capacity, capacity_source,
                         operable_capacity, current_count, manual_status, incentive, sensor_enabled,
                         shuttle_stop, note, data_source, sort_order, updated_at)
values ('learning-center', '화천평생학습관 주차장', 'NEAR', 38.10850, 127.71120,
        '임시 위치(주소 산천어길 91, 좌표 확인 전)', 50, '시연용 50면',
        null, 0, 'AUTO', false, true,
        null, '발표·시연 장소. 입구·출구 센서로 세고 있어요', '시연용', 0, current_timestamp);

update sensor_device
   set lot_id = (select id from parking_lot where code = 'learning-center')
 where device_id in ('entry-stm32', 'exit-pico');
