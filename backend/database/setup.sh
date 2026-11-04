#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# 학교 서버에 빈 데이터베이스를 준비합니다. 실행 전 백업을 남깁니다.
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
db_host=${DB_HOST:-127.0.0.1}
db_port=${DB_PORT:-3306}
db_user=${DB_ADMIN_USER:-root}
backup_root=${REZERO_BACKUP_DIR:-"$HOME/rezero-db-backups"}

for command_name in mariadb mariadb-dump; do
  command -v "$command_name" >/dev/null || { echo "$command_name 명령이 필요합니다." >&2; exit 1; }
done

read -r -s -p "MariaDB 관리자($db_user) 비밀번호: " MYSQL_PWD
echo
export MYSQL_PWD
trap 'unset MYSQL_PWD' EXIT
client=(mariadb --protocol=TCP --host="$db_host" --port="$db_port" --user="$db_user" --batch --skip-column-names)
dump=(mariadb-dump --protocol=TCP --host="$db_host" --port="$db_port" --user="$db_user")

exists=$("${client[@]}" -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='rezero'")
if [[ "$exists" == "1" ]]; then
  table_count=$("${client[@]}" -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='rezero'")
  if [[ "$table_count" != "0" ]]; then
    echo "rezero DB에 이미 테이블이 $table_count개 있습니다. 기존 데이터를 보호하기 위해 설치를 중단합니다." >&2
    exit 1
  fi
fi

mkdir -p -- "$backup_root"
backup_dir=$(mktemp -d "$backup_root/rezero-before-$(date +%Y%m%d-%H%M%S)-XXXXXX")
printf '%s\n%s\n' "$db_host" "$db_port" > "$backup_dir/server"
if [[ "$exists" == "1" ]]; then
  printf 'existing\n' > "$backup_dir/state"
  "${dump[@]}" --single-transaction --routines --triggers --events --databases rezero > "$backup_dir/rezero.sql"
  [[ -s "$backup_dir/rezero.sql" ]] || { echo "백업 파일이 비어 있어 중단합니다." >&2; exit 1; }
else
  printf 'absent\n' > "$backup_dir/state"
fi
printf '백업 위치: %s\n' "$backup_dir"

if ! "${client[@]}" < "$script_dir/setup.sql"; then
  echo "설치가 실패했습니다. DB가 일부 생성됐을 수 있습니다." >&2
  printf '복원 명령: bash "%s/rollback.sh" "%s"\n' "$script_dir" "$backup_dir" >&2
  exit 1
fi
if ! count=$("${client[@]}" -e 'SELECT COUNT(*) FROM rezero.problems'); then
  echo '설치 후 문제 수를 확인하지 못했습니다.' >&2
  printf '복원 명령: bash "%s/rollback.sh" "%s"\n' "$script_dir" "$backup_dir" >&2
  exit 1
fi
if [[ "$count" != "168" ]]; then
  printf '문제 수 검증 실패: %s개 (예상: 168개)\n' "$count" >&2
  printf '복원 명령: bash "%s/rollback.sh" "%s"\n' "$script_dir" "$backup_dir" >&2
  exit 1
fi
printf '설치 완료: 문제 %s개. 백업은 보관해주세요.\n' "$count"
printf '복원 명령: bash "%s/rollback.sh" "%s"\n' "$script_dir" "$backup_dir"
