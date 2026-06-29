# rezero
졸업작품 팀 프로젝트 리:제로

---

🧠 Code Battle Platform
<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)
![Backend](https://img.shields.io/badge/Backend-SpringBoot-6DB33F?logo=springboot)
![Language](https://img.shields.io/badge/Language-Java%20%7C%20TypeScript-blue)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)
![Jira](https://img.shields.io/badge/Jira-0052CC?logo=jira&logoColor=white)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-Private-red.svg)


**실시간 코드 대결 및 자동 채점 플랫폼**

[프로젝트 진행 흐름](#-프로젝트-진행-흐름) • [로컬 개발 환경](#-로컬-개발-환경) • [주요 기능](#-주요-기능) • [기술 스택](#-기술-스택)

</div>

---

## 🔄 프로젝트 진행 흐름
### 📅 회의 및 진행 일정
| 날짜         | 시간    | 내용                |
| ---------- | ----- | ----------------- |
| 2026-01-20 | 10:00 | 프로젝트 주제 브레인스토밍    |
| 2026-02-10 | 10:00 | 목표 및 아이디어 공유 |
| 2026-02-26 | 11:00 | 아이디어 후보 선정     |
| 2026-03-10 | 16:00 | 아이디어 도출  |
| 2026-03-11 | 13:00 | 교수님께 아이디어 컨펌 및 확정       |
| 2026-03-18 | 13:00 | 아이디어 구체화       |
| 2026-04-15 | 13:00 | 애자일 프로세스 설계 진행 및 팀원 과제 부여       |
| 2026-04-30 | 16:00 | 프론트&백 과제 점검       |
| 2026-05-04 | 10:00 | 프론트&백 공동 작업(예정)       |
| 2026-05-06 | 13:00 | 교수님께 과제 점검(예정)       |

---

## 💻 로컬 개발 환경

### 프로젝트 구조

```
rezero/
├── package.json        # 프론트·백엔드 공통 의존성 (메인)
├── package-lock.json
├── node_modules/       # 루트 한 곳에서만 설치
├── frontend/           # React + Vite + Electron 소스
│   └── package.json    # ESM 타입 선언용 (의존성 없음)
├── backend/            # Express API 소스
│   └── package.json    # CommonJS 타입 선언용 (의존성 없음)
└── README.md
```

### 사전 요구사항

- **Node.js** 20 이상 (LTS 권장)
- **npm** 10 이상
- **Git**

Electron 개발은 **Windows 또는 macOS**에서 진행합니다.  
리눅스 서버(헤드리스)에서는 Electron 창 실행이 어렵습니다.

### 최초 설정 (모든 팀원 공통)

```bash
git clone https://github.com/202107070/rezero.git
cd rezero
npm install
```

**프론트엔드 (Electron)**

```bash
npm run electron:dev
```

**백엔드**

```bash
npm run backend
# 개발 중 자동 재시작: npm run backend:dev
```

### 역할 분담 (권장)

| 환경 | 용도 |
|------|------|
| **Windows / macOS (각자 PC)** | 프론트 개발, Electron 실행, UI 확인 |
| **Linux 서버** | Git pull, 백엔드 API, 배포·테스트 서버 |

### ⚠️ 협업 시 주의사항

1. **`package.json` / `package-lock.json`은 Git에 반드시 포함합니다.** `.gitignore`에 넣지 마세요. 팀 전체가 같은 의존성 버전을 쓰려면 이 파일들이 저장소에 있어야 합니다.
2. **`node_modules`만 Git에 올리지 않습니다.** clone/pull 후 **저장소 루트(`rezero/`)** 에서 `npm install` 한 번 실행하세요.
3. **명령어도 루트에서 실행합니다.** `frontend/` 또는 `backend/` 폴더 안에서 `npm run …` 하면 모듈을 찾지 못하는 경우가 많습니다.
4. **리눅스 서버의 `node_modules`를 Windows PC로 복사해 쓰지 마세요.** Electron은 OS별 바이너리가 달라 실행이 실패할 수 있습니다.
5. 예전 구조로 남아 있는 `frontend/node_modules`, `backend/node_modules` 폴더가 있으면 **삭제**한 뒤, 루트에서 `npm install` 을 다시 하세요.
6. `package-lock.json`은 **루트에만** 유지합니다. (버전 고정용)

### 자주 나는 오류 (트러블슈팅)

| 증상 | 해결 |
|------|------|
| `Cannot find module 'react'` 등 모듈 없음 | 루트에서 `npm install` 실행. `frontend/` 안에서 install 하지 않기 |
| `frontend` 폴더에서 `npm run dev` 실패 | `cd ..` 후 `npm run dev` 또는 `npm run electron:dev` |
| pull 후 갑자기 실행 안 됨 | 루트에서 `git pull` → `npm install` (lock 파일이 바뀌었을 수 있음) |
| Electron 관련 이상 | `frontend/node_modules` 삭제 후 루트에서 `npm install` 재실행 |
| `preinstall` / 루트 설치 안내 메시지 | `frontend/`·`backend/`가 아닌 **프로젝트 루트**에서 `npm install` |

**클린 재설치 (문제 계속될 때, 루트에서):**

```bash
# Windows PowerShell 예시
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force backend/node_modules -ErrorAction SilentlyContinue
npm install
npm run electron:dev
```

### 자주 쓰는 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버만 실행 (브라우저) |
| `npm run electron:dev` | Vite + Electron 동시 실행 |
| `npm run build` | 프로덕션 빌드 |

---

## 📋 프로젝트 개요

re:zero는 코딩의 재미와 개발 실력 향상을 추구하는 코딩 대결 플랫폼입니다. 개발자, 컴공 계열 학생, 일반인까지도 누구나 쉽게 접하도록 구성되어 코드 작성부터 빌드, 채점 로직을 통한 자동 채점 기능까지 전부 제공하여 코딩의 재미 뿐만 아니라 피드백을 통한 개발 실력 향상까지 이끌어내는 올인원 코딩 학습 및 경쟁 플랫폼입니다.

---

## 🎯 프로젝트 목표
### 공정한 코드 실행 및 채점 환경 제공
### 실시간 대결 기능 구현
### 사용자 경험 중심 UI 설계
### 확장 가능한 채점 시스템 구조 설계

---

## 주요 특징

<채워야 됨!>

---

## 🎯 주요 기능

### 🧑‍💻 코드 대결 시스템
- 사용자 간 실시간 코딩 대결
- 문제 기반 매칭 시스템
- 제출 시간 및 정답 여부 기반 승패 판정

### ⚙️ 자동 채점 시스템
- 테스트케이스 기반 채점
- 다중 언어 실행 환경 지원 (확장 가능)
- Docker 컨테이너 기반 안전 실행

### 📚 문제 관리
- 문제 등록 및 수정
- 난이도 및 카테고리 분류
- 테스트케이스 관리

### 👤 사용자 시스템
- 회원가입 및 로그인
- 사용자 랭킹 시스템
- 전적 및 기록 관리

### 📊 결과 및 통계
- 문제 풀이 결과 제공
- 성공/실패 기록 저장
- 사용자 랭킹 및 통계 시각화

---

## 🛠️ 기술 스택
### 🎨 Frontend
- **React** - UI 라이브러리
- **TypeScript** - 타입 안정
- **Vite**
- **Zustand** - 상태 관리

### ⚙️ Backend
- **Spring Boot**
- **REST API**

### 🧪 채점 시스템
- **Docker** - 컨테이너 기반 코드 실행 / 테스트케이스 자동 채점

### ☁️ Infra
- **AWS (예정)**
- **Linux 서버**

### 🧰 개발 도구
- **Git / GitHub / Jira** - 버전관리 및 협업
- **VS Code / IntelliJ** - 통합 개발 환경
- **Postman** - REST API 테스트

---
