-- 이 파일은 조회 전용이다. 기존 행을 삭제하거나 닉네임을 변경하지 않는다.
-- 점검: node backend/scripts/nicknameUnique.js
-- 검토 후 적용: node backend/scripts/nicknameUnique.js --apply
-- JS 절차는 중복/collation/기존 인덱스를 검사하고 안전하게 재실행할 수 있다.
SELECT COUNT(*) AS duplicate_group_size
FROM users GROUP BY display_name HAVING COUNT(*) > 1;
