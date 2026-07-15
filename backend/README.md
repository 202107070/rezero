# Rezero Backend

백엔드는 Node.js, Express, CommonJS 기준으로 작업한다. API 기본 주소는 `/api/v1`이다.

## 실행

1. 저장소 루트에서 패키지를 설치한다.
2. `backend/.env.example`을 복사해서 `backend/.env`를 만들고 서버 값을 넣는다.
3. 저장소 루트에서 `npm run backend`를 실행한다.

MariaDB와 Valkey 연결이 모두 성공해야 8080 포트가 열린다.

서버 확인 주소:

- `GET /health`
- `GET /api/v1/health`

## 작업 위치

| 위치                           | 담당 작업 |
| ---                           | --- |
| `src/api/user`                | 인증, 사용자, 골드, 칭호, 전적 |
| `src/api/room`                | 방 REST API |
| `src/api/problem`             | 문제 조회와 선택 |
| `src/api/battle`              | 배틀 진행, 판정, 점수, 결과 |
| `src/api/build`               | 코드 실행 API |
| `src/config`, `src/db`        | MariaDB, Valkey, 환경변수 |
| `src/sockets`                 | 로비, 방, 배틀 WebSocket |
| `src/infra/redis`             | Valkey를 직접 사용하는 코드 |
| `src/infra/docker`            | Podman 실행 코드 |
| `src/middleware`, `src/utils` | 여러 API에서 같이 쓰는 코드 |

폴더 이름은 develop에 합친 뒤부터 옮기지 않는다. 새 기능은 담당 폴더 안에서 추가한다.

## 응답 규칙

성공 응답은 `frontend/backend-handoff.md`에 적힌 JSON 모양 그대로 보낸다.

오류 응답은 아래 모양으로 통일한다.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "요청한 주소를 찾을 수 없습니다."
  }
}
```
