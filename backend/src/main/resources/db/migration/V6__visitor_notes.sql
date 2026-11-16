-- 방문객 화면에 보이는 주차장 안내 문구를 방문객 말투로 정리. 내부 확인 메모는 출처 컬럼(capacity_source 등)과 docs 에 남긴다.
update parking_lot set note = '화천대교 건너 넓은 주차장. 바로 앞 화천체육관에서 셔틀 타요' where code = 'wirari';
update parking_lot set note = null where code in ('silver-center', 'old-mp');
update parking_lot set note = '대형버스 주차 가능' where code = 'info-hs';
update parking_lot set note = '캠핑카·카라반은 들어갈 수 없어요' where code = 'youth-center';
update parking_lot set note = '축제장과 가장 가까워요. 일찍 차요' where code = 'hwacheon-elem';
update parking_lot set note = '장애인 차량 전용' where code = 'dessian-acc';
update parking_lot set note = '캠핑카·카라반 전용' where code = 'tunnel3';
