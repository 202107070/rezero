# 개발단계별 보고서

졸업작품 **re:zero** (실시간 코딩 대결 플랫폼) 개발 과정을 7단계로 정리한 문서입니다.  
이론 설명보다 **우리가 정의·설계·구현한 결과** 위주로 작성했습니다.

| 단계 | 문서 | 핵심 산출물 |
|------|------|-------------|
| 1. 문제 정의 | [01-problem-definition.md](01-problem-definition.md) | 제안·문제 정의, Activity Diagram |
| 2. 요구사항 | [02-requirements.md](02-requirements.md) | MoSCoW 표, Use Case Diagram |
| 3. 시스템 설계 | [03-system-design.md](03-system-design.md) | ERD, API 요약, Sequence Diagram |
| 4. 구조·인프라 | [04-architecture-infra.md](04-architecture-infra.md) | Deployment, 기술 스택·Git 전략 |
| 5. 구현 | [05-implementation.md](05-implementation.md) | 화면·스니펫, State Diagram |
| 6. 테스트·검증 | [06-testing.md](06-testing.md) | TC 시트, 결함·개선 요약 |
| 7. 최종 문서화 | [07-maintenance.md](07-maintenance.md) | Runbook, 회고·백로그 |

## 다이어그램 정책

필수: **Activity · Use Case · ERD · Deployment**  
보충: 핵심 로직만 **Sequence · State**  
제외: Class / Component / Communication / Package 등 (군살)

## 관련 문서

- [설치·실행](../setup.md)
- [아키텍처 요약](../architecture.md)
- [백엔드 README](../../backend/README.md)
