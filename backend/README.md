# Rezero Backend

Node.js · Express · Socket.io 백엔드입니다. API 기본 주소는 `/api/v1`입니다.

## 실행

1. 저장소 **루트**에서 `npm ci`
2. `backend/.env.example` → `backend/.env` 작성
3. 루트에서 `npm run backend` 또는 `npm run backend:dev`

MariaDB와 Valkey 연결이 성공해야 기본 포트 **8080**이 열립니다.

확인:

- `GET /health`
- `GET /api/v1/health`

자세한 환경 설정은 [docs/setup.md](../docs/setup.md)를 참고하세요.

## 작업 위치

| 위치 | 담당 |
|------|------|
| `src/api/user` | 인증, 사용자, 골드, 칭호, 전적, AI 분석 |
| `src/api/room` | 방 REST API |
| `src/api/problem` | 문제 조회·선택 |
| `src/api/battle` | 배틀 진행, 판정, 점수, 결과, 아이템 |
| `src/api/build` | 코드 실행 API |
| `src/handler` | Socket.io 이벤트 |
| `src/service` | presence·소켓 공용 로직 |
| `src/config`, `src/db` | MariaDB, Valkey, 환경변수 |
| `src/infra/redis` | Valkey 직접 사용 |
| `src/infra/docker` | Podman 실행 |
| `src/models` | SQL 마이그레이션 메모 |
| `src/middleware`, `src/utils` | 공용 미들웨어·유틸 |

새 기능은 담당 폴더 안에서 추가합니다.

## 오류 응답

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "요청한 주소를 찾을 수 없습니다."
  }
}
```

초기 연동 초안(참고용)은 [docs/archive/frontend-backend-handoff.md](../docs/archive/frontend-backend-handoff.md)에 있습니다. 최신 동작은 코드와 실제 API를 기준으로 하세요.
