# 7단계: 수정 및 최종 문서화 (Maintenance & Documentation)

## 7.1 운영·장애 대응 가이드 (Runbook 요약)

### 일상 배포 (서버)

```bash
cd /path/to/rezero
git pull origin main   # 또는 develop
npm ci
# backend/.env 확인
npm run backend        # 또는 systemd/pm2/compose 재시작
```

Docker Compose 사용 시 (`backend/docker-compose.yml` 기준):

```bash
docker compose -f backend/docker-compose.yml up -d --build
```

### 클라이언트

| 환경 | 명령 |
|------|------|
| 개발 | 루트에서 `npm run electron:dev` |
| 빌드 | `npm run build` 후 `npm start` |

### 헬스 체크

| URL | 의미 |
|-----|------|
| `GET /health` | 프로세스 생존 |
| `GET /api/v1/health` | API 준비 |

### 예외 처리 요약

| 증상 | 점검 | 조치 |
|------|------|------|
| 8080 안 열림 | MariaDB·Valkey·`.env` | 서비스 기동·계정·호스트 확인 |
| 로그인만 되고 방/소켓 끊김 | 방화벽·CORS·소켓 경로 | 동일 오리진/프록시 설정 |
| 배틀 중 아이템/힌트 이상 | 백엔드 버전 불일치 | pull 후 **백엔드 재시작** |
| 전체화면 UI 깨짐 | 구버전 프론트 | 최신 빌드·캐시 제거 |
| AI 분석 실패 | `CURSOR_API_KEY` | `.env` 키·쿼터 확인 |
| DB 스키마 오류 | 마이그레이션 | `osDB.sql` / `addDisplayNameUnique.sql` 적용 |

### 로그·데이터

| 위치 | 용도 |
|------|------|
| 백엔드 콘솔 | 소켓 join, 재접속, 에러 |
| MariaDB | users, matches, submissions |
| Valkey | presence, room state |
| `match_code_history` | 전적·AI 분석 입력 |

---

## 7.2 최종 산출물 체크리스트

| 산출물 | 위치 |
|--------|------|
| 소스 | `frontend/`, `backend/` (`main` 브랜치) |
| 설치 가이드 | [docs/setup.md](../setup.md) |
| 단계별 보고서 | [docs/report/](./) |
| DB 스키마 | `backend/src/models/osDB.sql` |
| Compose | `backend/docker-compose.yml` |

---

## 7.3 프로젝트 회고

### 잘된 점

- 프론트·백 실시간 연동으로 **로비→배틀→결과** 풀사이클 완성
- 서버 채점·보상으로 공정성 확보
- 아이템전·리뷰·전적으로 게임성·학습성 균형
- Electron으로 발표·시연 환경 고정

### 어려웠던 점

- 라이브 매치에서 정답 미노출과 힌트/아이템 UX 충돌
- presence·이탈 감지 타이밍 (결과창 오탐)
- 전체화면에서 px 고정 UI 스케일 문제

### 학습 성과

- REST + Socket.io 하이브리드 설계
- 관계형 DB + 캐시 역할 분리
- 졸업작품 단위의 요구사항→설계→검증 문서화

---

## 7.4 향후 백로그

| 우선 | 항목 | 메모 |
|------|------|------|
| P1 | CI (lint/build) GitHub Actions | 품질 자동화 |
| P1 | 자동 스모크 E2E (로그인~결과) | Playwright 등 |
| P2 | 관리자 문제 CMS | 현재 SQL·시드 |
| P2 | 모바일/반응형 웹 | Electron 외 채널 |
| P3 | 관전 고도화 · 리플레이 | |
| P3 | 매치메이킹(랜덤 매칭) | 현재 방 기반 |

---

## 7.5 문서 유지 원칙

1. **코드가 바뀌면** `docs/report`의 API·ERD·TC를 같이 수정한다.
2. 이론 슬라이드·개념 정의는 넣지 않는다.
3. 구버전 초안은 `docs/archive/`에만 두고, 본 보고서는 `docs/report/`를 정본으로 한다.
