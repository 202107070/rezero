-- 기존 DB에 닉네임 유니크 제약을 추가한다.
-- 이미 중복 닉네임이 있으면 먼저 정리한 뒤 실행하세요.
ALTER TABLE users
  ADD UNIQUE KEY uq_users_display_name (display_name);
