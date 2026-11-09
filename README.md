# re:zero

졸업작품 팀 프로젝트 **리:제로** — 실시간 코딩 대결 · 자동 채점 · Electron 클라이언트 플랫폼

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20%2B%20Electron-61DAFB?logo=react)
![Backend](https://img.shields.io/badge/Backend-Express-000000?logo=express)
![Language](https://img.shields.io/badge/Language-TypeScript%20%7C%20JavaScript-blue)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![Valkey](https://img.shields.io/badge/Valkey%2FRedis-DC382D?logo=redis&logoColor=white)

**실시간 코드 대결 및 자동 채점 플랫폼**

[문서](docs/README.md) · [설치·실행](docs/setup.md) · [구조](docs/architecture.md)

</div>

---

## 프로젝트 개요

re:zero는 코딩의 재미와 실력 향상을 목표로 한 **실시간 코딩 대결** 플랫폼입니다.  
로비·대기방·배틀·결과·연습·빌드까지 Electron 앱으로 이어지며, 빈칸/객관식/단답 문제와 아이템전, 레이팅·골드·칭호를 제공합니다.

---

## 팀 소개

| 역할 | 이름 | 담당 |
|:----:|:----:|:----:|
| 팀장 | **조호진** | 프로젝트 총괄 |
| 팀원 | 박영환 | Backend |
| 팀원 | 유동관 | Backend |
| 팀원 | 장영민 | Frontend |
| 팀원 | 오현서 | Frontend |

---

## 주요 기능

- **실시간 대결** — 1대1 / 1대N, 일반·아이템 모드, Socket.io 동기화
- **문제·채점** — Java / Python / C++ 빈칸·객관식·단답, 서버 판정
- **아이템전** — 페인트·번개·낙서·잠금·시간감소·힌트·빌드+ 등
- **빌드·연습** — 코드 블록 빌드 시뮬레이터, 단독 연습 모드
- **계정·성장** — 회원가입/로그인, 레이팅·골드·칭호, 매치 전적·AI 분석
- **클라이언트** — Electron 창 모드(1280×960) / 전체화면 스케일

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React, TypeScript, Vite, Electron, CodeMirror |
| Backend | Node.js 20+, Express, Socket.io |
| DB / Cache | MariaDB, Valkey(Redis) |
| 실행 환경 | Podman(코드 실행 API) |
| 협업 | Git / GitHub |

---

## 빠른 시작

```bash
git clone https://github.com/202107070/rezero.git
cd rezero
git checkout main   # 또는 develop
npm ci

# backend/.env.example → backend/.env 설정 후
npm run backend:dev      # API :8080
npm run electron:dev     # 클라이언트
```

자세한 절차·트러블슈팅은 [docs/setup.md](docs/setup.md)를 참고하세요.

---

## 저장소 구조

```
rezero/
├── frontend/     # React + Vite + Electron
├── backend/      # Express API + Socket.io
├── docs/         # 프로젝트 문서
├── package.json  # 루트에서 의존성·스크립트 관리
└── README.md
```

---

## 브랜치

| 브랜치 | 용도 |
|--------|------|
| `main` | 안정 버전 / 발표·배포 기준 |
| `develop` | 통합 개발 |

기능 작업은 `develop`에서 진행한 뒤 `main`으로 머지합니다.

---

## 문서

| 문서 | 설명 |
|------|------|
| [docs/README.md](docs/README.md) | 문서 목록 |
| [docs/report/](docs/report/README.md) | **개발단계별 보고서 (문제정의~최종문서화)** |
| [docs/setup.md](docs/setup.md) | 로컬 설치·실행 |
| [docs/architecture.md](docs/architecture.md) | 디렉터리·모듈 구조 |
| [backend/README.md](backend/README.md) | 백엔드 작업 가이드 |
| [docs/archive/](docs/archive/) | 과거 초안·핸드오프 (참고용) |

---

## 라이선스

Private — 졸업작품 팀 프로젝트
