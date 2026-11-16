-- 평생학습관 주차장 안내 문구 삭제(목록에는 '축제장 인근'으로 표시)
update parking_lot set note = null where code = 'learning-center';
