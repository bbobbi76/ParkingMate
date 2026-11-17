-- 위라리 둔치 좌표가 강 위에 찍혀 있어서, OpenStreetMap 에 있는 화천체육관 옆 주차장(way 481182666) 쪽 땅 위로 옮긴다.
-- 정확한 위치는 현장 관리 화면 「주차장 위치·추가」에서 지도를 눌러 고칠 수 있다.
update parking_lot
   set lat = 38.09862, lng = 127.70660,
       coord_source = 'OSM 화천체육관 옆 주차장 기준(현장 확인 필요)',
       updated_at = current_timestamp
 where code = 'wirari';
