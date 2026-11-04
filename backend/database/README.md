# 학교 서버 MariaDB 초기 설정

`setup.sql`은 develop `9d8372b`의 DB 구조와 라즈베리파이에서 조회한 문제 168개를 포함합니다. 기존 코드가 실행 중 추가하던 `friend_requests` 테이블과 `match_code_history.ai_analysis` 컬럼도 포함했습니다. 사용자, 전적, 방 등 기존 운영 데이터는 포함하지 않습니다.

MariaDB 서버 및 `mariadb`, `mariadb-dump` 클라이언트를 설치하고 관리자 계정에 DB 생성/삭제 및 백업 권한을 부여한 후 프로젝트 루트에서 실행합니다.

```bash
bash backend/database/setup.sh
```

기본 접속 대상은 `127.0.0.1:3306`, 계정은 `root`입니다. 다르면 실행 전에 `DB_HOST`, `DB_PORT`, `DB_ADMIN_USER` 환경변수를 설정하세요. 비밀번호는 명령어에 적지 않고 실행 중 입력합니다. TCP 접속 가능한 MariaDB 계정을 사용하세요.

스크립트는 `rezero` DB가 없거나 테이블이 없을 때만 설치합니다. 기존 테이블이 있으면 아무것도 변경하지 않고 중단합니다. 설치 직전 상태는 기본적으로 `~/rezero-db-backups/`에 저장하고 백업 위치와 복원 명령을 출력합니다. DB가 없었던 경우에는 없었다는 상태만 기록합니다. 백업에는 민감한 데이터가 들어갈 수 있으므로 외부에 공유하거나 Git에 올리지 마세요.

실패했거나 설치를 되돌리려면 출력된 백업 경로로 실행합니다.

```bash
bash backend/database/rollback.sh "출력된_백업_경로"
```

복원은 현재 `rezero` DB를 삭제한 뒤 백업을 되돌립니다. 설치 후 변경한 데이터는 사라집니다. 서버와 사용자 접속을 먼저 중지하고, 복원 스크립트에도 설치 당시와 같은 `DB_HOST`, `DB_PORT`, `DB_ADMIN_USER`를 설정해야 합니다. 백업을 보관할 저장 공간과 DB 생성·삭제 권한이 필요합니다.

DB만 필요한 경우 SQL을 직접 실행할 수 있지만, 백업이나 기존 DB 보호는 자동으로 이뤄지지 않습니다.

```bash
mariadb -u root -p < backend/database/setup.sql
```

백엔드 실행에는 별도로 MariaDB 접속 계정 및 권한, Valkey, `backend/.env`, Node.js 의존성이 필요합니다. 설정 파일은 `backend/.env.example`을 참고하세요.
