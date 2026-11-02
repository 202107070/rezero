# 로컬 개발 환경

## 사전 요구사항

- **Node.js** 20 이상 (LTS 권장)
- **npm** 10 이상
- **Git**
- **MariaDB**, **Valkey(Redis)** — 백엔드 기동에 필요
- Electron 개발은 **Windows 또는 macOS** 권장

## 프로젝트 구조

```
rezero/
├── package.json        # 공통 의존성·스크립트 (루트에서만 설치)
├── frontend/           # React + Vite + Electron
├── backend/            # Express API
└── docs/               # 문서
```

의존성은 **저장소 루트**에서만 설치합니다. `frontend/`, `backend/` 안에서 `npm install` 하지 마세요.

## 최초 설정

```bash
git clone https://github.com/202107070/rezero.git
cd rezero
npm ci
```

`backend/.env.example`을 복사해 `backend/.env`를 만들고 DB·Valkey·JWT 등을 채웁니다.

## 실행

**백엔드** (기본 포트 8080)

```bash
npm run backend
# 자동 재시작
npm run backend:dev
```

확인:

- `GET /health`
- `GET /api/v1/health`

**프론트 (Electron)**

```bash
npm run electron:dev
```

브라우저만 쓸 때:

```bash
npm run dev
```

## 자주 쓰는 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 (브라우저) |
| `npm run electron:dev` | Vite + Electron |
| `npm run build` | 프로덕션 빌드 |
| `npm run backend` | 백엔드 실행 |
| `npm run backend:dev` | 백엔드 nodemon |
| `npm run rooms:reset-test` | 테스트용 로비 방 초기화 |

## 역할 분담 (권장)

| 환경 | 용도 |
|------|------|
| Windows / macOS | 프론트, Electron, UI 확인 |
| Linux 서버 | `git pull`, 백엔드 API, 배포·테스트 |

## 협업 시 주의

1. `package.json` / `package-lock.json`은 Git에 포함합니다. `.gitignore`에 넣지 마세요.
2. `node_modules`만 올리지 않습니다. clone/pull 후 **루트**에서 `npm ci`.
3. 스크립트도 **루트**에서 실행합니다.
4. 리눅스 서버의 `node_modules`를 Windows로 복사하지 마세요 (Electron 바이너리 불일치).
5. 예전 `frontend/node_modules`, `backend/node_modules`가 있으면 삭제한 뒤 루트에서 다시 설치하세요.

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| `npm ci` — lock 없음 / out of sync | 루트인지 확인 → `git restore package.json package-lock.json` → `git pull` → `npm ci` |
| `Cannot find module 'react'` | 루트에서 `npm ci` |
| `frontend`에서 `npm run …` 실패 | `cd ..` 후 루트 스크립트 사용 |
| pull 후 실행 안 됨 | `git pull` → `npm ci` |
| MariaDB/Valkey 연결 실패 | `backend/.env`와 서비스 기동 상태 확인 |

**클린 재설치 (PowerShell, 루트에서):**

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force backend/node_modules -ErrorAction SilentlyContinue
git restore package.json package-lock.json
npm ci
```
