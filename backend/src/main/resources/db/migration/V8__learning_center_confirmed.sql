-- 2026-11-17 팀이 지도에서 위치 확인함(좌표 그대로). 임시 표시만 지운다.
update parking_lot
   set coord_source = '주소 산천어길 91 (팀 확인)'
 where code = 'learning-center';
