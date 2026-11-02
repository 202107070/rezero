# 아키텍처·디렉터리 구조

## 한눈에 보기

```
Electron 클라이언트 (React)
        │  HTTP /api/v1
        │  Socket.io
        ▼
Express 백엔드
   ├── MariaDB   (계정, 방, 매치, 전적, 아이템 …)
   ├── Valkey    (세션, 로비 presence, 방 상태 …)
   └── Podman    (빌드/코드 실행 API)
```

## Frontend (`frontend/`)

| 경로 | 역할 |
|------|------|
| `src/pages/` | 로그인, 로비, 방, 배틀, 결과, 연습, 빌드 |
| `src/components/` | UI 컴포넌트 |
| `src/services/` | REST·소켓·세션 store |
| `src/utils/` | 채점 UI, 오디오, 빌드 시뮬 등 |
| `src/constants/` | 아이템·루트·레이아웃 상수 |
| `electron/` | Electron main / preload |
| `public/` | 정적 자산·오디오 |

화면 흐름: **로그인 → 로비 → 대기방 → 배틀 → 결과** (+ 연습/빌드)

표시 모드: 창 모드 1280×960, 전체화면은 동일 캔버스를 모니터에 맞게 스케일 (`--ui-scale`).

## Backend (`backend/`)

API prefix: `/api/v1`

| 경로 | 역할 |
|------|------|
| `src/api/user` | 인증, 프로필, 골드, 칭호, 전적, AI 분석 |
| `src/api/room` | 방 REST |
| `src/api/problem` | 문제 조회·선정 |
| `src/api/battle` | 매치 진행, 제출, 아이템, 랭킹 |
| `src/api/build` | 코드 실행 세션 |
| `src/handler` | Socket.io 핸들러 |
| `src/service` | 소켓·presence 등 공용 서비스 |
| `src/config`, `src/db` | 환경변수, DB 연결 |
| `src/infra/redis` | Valkey |
| `src/infra/docker` | Podman 실행 |
| `src/models` | SQL 스키마·마이그레이션 메모 |
| `bin/www` | 서버 엔트리 |

## 문서 위치

자세한 설치는 [setup.md](setup.md), 문서 목록은 [README.md](README.md)를 보세요.
