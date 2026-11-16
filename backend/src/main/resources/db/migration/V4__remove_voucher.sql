-- 2026-11-16 팀 결정: QR·무료이용권 기능을 빼고 남은 자리 안내 + 센서 집계 + 셔틀에 집중한다.
alter table vehicle_event drop column voucher_id;
drop table voucher;
drop table benefit;
alter table parking_lot drop column incentive;
