-- 발표·시연 주차장(화천평생학습관)에도 이용권 혜택 안내를 표시한다(팀 결정 2026-11-19).
update parking_lot set incentive = true, updated_at = current_timestamp where code = 'learning-center';
