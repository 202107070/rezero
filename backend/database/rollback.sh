#!/usr/bin/env bash
set -Eeuo pipefail

# 지정한 백업의 설치 직전 상태로 rezero DB를 복원합니다.
backup_dir=${1:-}
if [[ -z "$backup_dir" || ! -f "$backup_dir/state" ]]; then
  echo '사용법: bash backend/database/rollback.sh "백업_디렉터리"' >&2
  exit 1
fi
state=$(cat "$backup_dir/state")
if [[ "$state" != "existing" && "$state" != "absent" ]]; then
  echo '유효하지 않은 백업 상태입니다.' >&2
  exit 1
fi
if [[ "$state" == "existing" && ! -s "$backup_dir/rezero.sql" ]]; then
  echo '복원할 SQL 백업이 없거나 비어 있습니다.' >&2
  exit 1
fi
command -v mariadb >/dev/null || { echo 'mariadb 명령이 필요합니다.' >&2; exit 1; }

db_host=${DB_HOST:-127.0.0.1}
db_port=${DB_PORT:-3306}
db_user=${DB_ADMIN_USER:-root}
if [[ ! -f "$backup_dir/server" ]]; then
  echo '백업 서버 정보가 없어 복원을 중단합니다.' >&2
  exit 1
fi
saved_host=$(sed -n '1p' "$backup_dir/server")
saved_port=$(sed -n '2p' "$backup_dir/server")
if [[ "$saved_host" != "$db_host" || "$saved_port" != "$db_port" ]]; then
  echo "백업 서버($saved_host:$saved_port)와 현재 서버($db_host:$db_port)가 달라 복원을 중단합니다." >&2
  exit 1
fi
printf '주의: %s:%s의 현재 rezero DB를 삭제하고 백업 상태(%s)로 되돌립니다.\n' "$db_host" "$db_port" "$state"
echo '설치 후 생성되거나 수정된 데이터는 사라집니다. 접속 중인 서버와 사용자를 먼저 중지하세요.'
read -r -p '계속하려면 RESTORE rezero를 입력하세요: ' confirmation
[[ "$confirmation" == 'RESTORE rezero' ]] || { echo '복원을 취소했습니다.'; exit 1; }
read -r -s -p "MariaDB 관리자($db_user) 비밀번호: " MYSQL_PWD
echo
export MYSQL_PWD
trap 'unset MYSQL_PWD' EXIT
client=(mariadb --protocol=TCP --host="$db_host" --port="$db_port" --user="$db_user")
"${client[@]}" -e 'SELECT 1' >/dev/null
"${client[@]}" -e 'DROP DATABASE IF EXISTS `rezero`'
if [[ "$state" == "existing" ]]; then
  if ! "${client[@]}" < "$backup_dir/rezero.sql"; then
    echo "복원 중 오류가 발생했습니다. 백업 파일은 $backup_dir/rezero.sql 에 남아 있습니다." >&2
    exit 1
  fi
fi
echo '설치 직전 상태로 복원했습니다.'
