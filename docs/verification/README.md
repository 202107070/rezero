# 게임 정상화 검증 기록

학교의 별도 환경에서 구현·항목별 검증·전체 통합·실제 브라우저 검증을 진행했다. 개발 브랜치와 운영 적용은 별개다. 상세 과정과 발견/수정 내역은 [실행 계획](../game-stability-plan.md), 적용/복구는 [서버 절차](../game-stability-deployment.md)에 기록했다.

2026-11-06 사용자 확정: 최종 서버는 학교 컴퓨터다. Pi 검증은 필수 완료 조건에서 제외하며 부팅 설정 변경과 재부팅은 진행하지 않는다.

## 최종 확인

| 검증 | 결과 |
| --- | --- |
| Backend 단위 / 실제 인증 HTTP / frontend 단위 / 기존 규칙 | 16 / 1 / 12 / 3개 통과 |
| 실제 MariaDB·Valkey·Podman 통합 묶음 | 저장·빌드·닉네임·아이템·Socket·확정 보상·중복 지급 방지 통과 |
| 코드 실행 | 43개 명시적 템플릿, 문법/런타임/시간/출력 제한, 파일/네트워크/비루트 격리, 8개 동시 요청 통과 |
| 타입 / 프론트 / Electron 빌드 | 통과. 기존 번들 경고 유지 |
| Chrome 두 계정 실제 경기 | Python 3회, Java/C++/HTML/CSS 각 1회, 총 7경기 완료 |
| 저장/복원 | 빈칸·객관식·문제 위치·본인/상대 진행·남은 시간·빌드 횟수·문제 시작 시점 확인 |
| 반복 경기 / 통신 지연 | 같은 방 다음 경기 분리, 8초 응답 지연 시 답안 보존/재시도, 종료 통지 누락 복구 확인 |
| 최종 퇴장 | 잘못된 legacy DELETE 제거 후 로비 복귀 구간 HTTP 200 37건/201 6건, 오류 0건 |
| Pi (참고) | arm64 이미지 빌드·단위·닉네임 검증. memory cgroup 비활성화로 사용자 코드 격리/전체 게임 차단 |

첫 경기 외에는 유형 누락을 피하도록 지정된 QA 경기의 스냅샷만 기존 문제 은행의 항목으로 고정했다. 운영 문제나 데이터는 바꾸지 않았다. 초기 검증에서 발견한 실패도 [JSON 기록](verification-report.json)에 남겼으며 마지막 회귀 결과와 구분했다. Java에서 재현된 종료 통지 누락은 상태 조회로 복구했고, 이후 C++/HTML/CSS는 양쪽 모두 자동으로 결과로 이동했다.

## 증거 화면

- [Python 실제 출력과 빌드+ 5/6](game-real-build.png)
- [새로고침/재경기 후 결과](game-final-result.png)
- [Java 실제 hello 출력](game-java-build.png), [종료 상태/보상 복구 결과](game-java-result-recovered.png)
- [C++ 실제 hi 출력](game-cpp-build.png)
- [HTML 목록/표](game-html-preview.png)
- [CSS 정렬 문제](game-css-preview.png), [CSS 종료 결과](game-css-result.png)

## 테스트 실행 위치

다음 명령은 저장소 **루트**에서 실행한다. `backend/test` 안에 들어가 있다면 `cd ../..`로 루트로 이동한다.

```sh
node --test backend/test/sessionService.test.js backend/test/problemVariants.test.js backend/test/executionService.test.js backend/test/isolatedRunner.test.js backend/test/signupConflict.test.js
node --test backend/test/sessionRoutes.test.js
node --import tsx --test frontend/test/*.test.ts
node backend/test/testBattleRules.js
npm run build
```

아래는 별도 테스트 DB/Valkey/API에서만 실행한다. 운영 실행 방지 가드가 있다.

```sh
node backend/test/testIsolatedRunner.js
TEST_BASE_URL=http://127.0.0.1:18082 node backend/test/runStabilityIntegration.js
node backend/scripts/gamePreflight.js
```

Pi의 부팅 입력 파일은 `/boot/efi/cmdline.txt`다. 이 파일에는 cgroup 인자가 없지만 실제 `/proc/cmdline`에는 `cgroup_disable=memory`가 적용되어 있다. 해당 설정의 백업/변경/재부팅은 수행하지 않았다. Pi 전체 정상 판정에는 추가 조치가 필요하지만, 학교 최종 서버 적용에는 이 조치가 필요하지 않다.
