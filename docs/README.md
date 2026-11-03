# re:zero 문서

프로젝트 문서는 이 폴더에 모읍니다. 루트 [README.md](../README.md)는 개요·빠른 시작만 유지합니다.

## 현재 문서

| 파일 | 설명 |
|------|------|
| [setup.md](setup.md) | Node 설치, `.env`, 프론트/백 실행, 자주 나는 오류 |
| [architecture.md](architecture.md) | 프론트·백엔드 폴더 구조와 역할 |
| [**report/**](report/README.md) | **개발단계별 보고서 (1~7단계)** |
| [../backend/README.md](../backend/README.md) | API 영역별 작업 위치, 응답 규칙 |
| [../frontend/README.md](../frontend/README.md) | 프론트 실행 요약 |

코드 옆에 두는 짧은 README:

| 파일 | 설명 |
|------|------|
| [../backend/src/models/README.md](../backend/src/models/README.md) | SQL 마이그레이션 파일 규칙 |
| [../backend/src/api/build/README.md](../backend/src/api/build/README.md) | BUILD API / Podman 위치 |

## 아카이브 (`archive/`)

초기에 작성해 현재 구현과 다를 수 있는 자료입니다. **최신 API·스키마의 소스 오브 트루스로 쓰지 마세요.**

| 파일 | 원래 위치 | 비고 |
|------|-----------|------|
| [frontend-backend-handoff.md](archive/frontend-backend-handoff.md) | `frontend/backend-handoff.md` | 연동 초안 (mock 기준) |
| [front.txt](archive/front.txt) | `frontend/front.txt` | 프론트 작업 메모 |
| [data-dictionary.txt](archive/data-dictionary.txt) | `frontend/data-dictionary.txt` | 데이터 사전 초안 |

아카이브에 새 파일을 넣을 때는 상단에 `참고용 · 최신 코드와 불일치할 수 있음`을 적어 주세요.
