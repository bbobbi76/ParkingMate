-- 2026-11-16 팀 결정: 이용권 발급·사용·QR 기능은 뺀다. 이용권 지급은 화천군(축제 운영) 쪽이 맡는다.
-- 서비스에는 "이 주차장에 대면 이용권 지급(검토 중)" 안내만 남기므로 parking_lot.incentive 는 유지한다.
alter table vehicle_event drop column voucher_id;
drop table voucher;
drop table benefit;
