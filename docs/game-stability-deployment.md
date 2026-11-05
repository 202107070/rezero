# 게임 정상화 브랜치 적용 절차

수정 브랜치: `fix/backend-integration-stability`. 이 문서는 운영 적용 명령의 검토 자료다. 현재 운영 DB/서버/방화벽에는 적용하지 않았다.

## 최종 배포 대상 — 2026-11-06 확정

최종 게임 서버는 학교 컴퓨터 `100.75.215.11`이다. 운영 적용과 완료 판정은 학교 서버를 기준으로 한다. Pi는 비교 검증 대상이며 배포 대상이 아니다. 아래 Pi 진단·적용 제안은 참고 기록으로만 남기고 실행하지 않는다. Pi의 cgroup 문제는 학교 배포를 막는 조건이 아니다.

2026-11-06 운영 조회: 8080 수신 없음, 분리 테스트 18082 정상. 운영 DB·Valkey와 닉네임 제약은 정상이며 운영 문제/서비스 컬럼은 테스트와 일치한다. 원본의 미커밋 변경을 보존할 별도 버전 경로와 채팅 캐시를 지우지 않는 기동 준비가 필요하다. [조회 결과와 적용 범위](verification/school-production-precheck-20261106.md). 이 조회만으로 운영 배포를 완료한 것으로 판정하지 않는다.

## 분리된 검증 환경

| 서버 | 테스트 경로 | 백엔드 | DB | Valkey |
| --- | --- | --- | --- | --- |
| 학교 amd64 | `/home/user1/rezero-stability-test-20261105` | `127.0.0.1:18082` | `rezero_stability_20261105` | `127.0.0.1:16379` |
| Pi arm64 | `/home/dgyu/rezero-stability-test-20261105` | `127.0.0.1:18082` | `rezero_stability_20261105` | `127.0.0.1:16379` |

두 서버의 테스트 DB 계정은 각 테스트 DB에만 권한이 있다. 운영 `.env`는 복사하지 않으며 테스트 시크릿은 각 서버에서 생성한 비추적 파일이다. 테스트 실행 전 DB 이름·Valkey 포트·API 포트 가드를 확인한다. 서버별 8080/6379와 기존 체크아웃은 이 환경과 별개다.

## 적용 전 준비

1. 현재 커밋·실행 경로·DB 백업과 복구 위치를 기록한다. 진행 중 경기가 없을 때 적용한다. 기존 경기 스냅샷은 새 템플릿으로 자동 변경하지 않는다.
2. 브랜치를 검토하고 운영 대상 커밋을 고정한다. 운영 환경값을 유지하면서 `.env.example`의 실행기 설정만 별도로 검토한다. 기존 compose는 실행기 연결이 완성된 운영 경로가 아니므로 이번 적용에 사용하지 않는다.
3. rootless Podman을 실행하는 백엔드 계정으로 저장소 **루트**에서 이미지를 준비한다. 최종 배포용 이미지는 학교 amd64 서버에서 빌드한다.

```sh
podman build -f backend/src/infra/docker/dockerimage/runner.Dockerfile -t localhost/rezero-runner:1 .
node backend/test/testIsolatedRunner.js
node backend/scripts/gamePreflight.js
```

실행기는 네트워크 없는 비루트 컨테이너, 1 CPU/384MB/64 PID, 읽기 전용 루트·소스, 64MB 임시 작업 공간을 사용한다. 컨테이너 엔진 소켓을 게임 컨테이너에 노출하지 않는다. 백엔드는 해당 계정에서 rootless Podman CLI를 호출한다. 실행기 검증이 실패하면 게임 시작이 차단된다.

4. 닉네임 제약을 조회한다. 중복이 있으면 적용을 중단한다. 기존 데이터는 삭제/개명하지 않는다. Pi 제약 추가는 현재 운영 적용 범위에 포함하지 않는다.

```sh
node backend/scripts/nicknameUnique.js
# 검토 후 필요한 서버에서만 실행한다.
node backend/scripts/nicknameUnique.js --apply
```

5. 프론트와 백엔드의 배포 버전을 함께 맞춘다. 저장/복원 API·문제 실행 메타데이터·실제 빌드 API가 연결되어 있어 한쪽만 구버전이면 정상 동작을 보장할 수 없다. 서버 재시작/서비스 등록은 실제 운영 실행 방식에 맞춰 별도로 검토한다.

운영 기동에는 `PRESERVE_CHAT_ON_START=true`를 지정한다. 이 옵션은 기존 시작 시 채팅 캐시 정리만 생략하며 채팅 기능과 일반 개발 기동 기본값은 유지한다. `testRedisStartup.js`는 분리된 테스트 Valkey에서 현재/과거 형식의 채팅 키와 TTL 보존을 검증한다.

## 프론트 대상과 원격 접근

Vite 개발 서버는 API와 Socket을 같은 `VITE_API_PROXY_TARGET`으로 전달한다. Electron 개발 실행도 같은 Vite 구성을 사용한다. 기본 대상은 최종 서버인 학교 `http://100.75.215.11:8080`이다. 별도 테스트 환경에서는 주소를 명시적으로 지정한다.

학교에서 별도 프론트 실행:

```sh
VITE_API_PROXY_TARGET=http://127.0.0.1:18082 VITE_SYNC_BACKEND=true npm run dev -- --host 127.0.0.1 --port 15174
```

맥에서 포트 터널:

```sh
ssh -N -L 15174:127.0.0.1:15174 user1@100.75.215.11
```

브라우저 `http://127.0.0.1:15174` → 학교 Vite → 학교 테스트 API/Socket 18082로 연결된다. 이 방식은 방화벽 변경이 필요 없다. Pi를 검증할 때는 SSH 대상과 로컬 포트를 분리한다.

운영 8080을 팀원에게 직접 열어야 한다면 먼저 `ss -ltnp`, 내부 `/health`, Tailscale 연결, `firewall-cmd --get-active-zones`로 원인을 구분한다. `API key loaded` 로그는 HTTP listen 완료를 뜻하지 않는다. 서버가 8080에 실제로 수신 중인지 먼저 확인한다.

다음은 학교 firewalld 적용 **검토용** 명령이다. `<...>`를 실제 값으로 바꾼다. 공개 인터페이스에 8080 전체 허용을 추가하지 않는다. 팀원마다 허용된 Tailscale /32 주소로 제한하고 Tailnet 접근 정책도 함께 확인한다.

```sh
# ZONE은 실제 활성 zone, TEAM_IP는 승인된 팀원의 Tailscale IPv4 주소
ZONE='<활성_zone>'
TEAM_IP='<팀원_Tailscale_IP>'
sudo firewall-cmd --zone="$ZONE" --add-rich-rule="rule family=ipv4 source address=$TEAM_IP/32 port port=8080 protocol=tcp accept"
# 팀원 /health 및 Socket 접속 검증 후 같은 규칙을 영구 설정한다.
sudo firewall-cmd --permanent --zone="$ZONE" --add-rich-rule="rule family=ipv4 source address=$TEAM_IP/32 port port=8080 protocol=tcp accept"
# 복구: 추가한 규칙만 runtime/permanent에서 제거한다.
sudo firewall-cmd --zone="$ZONE" --remove-rich-rule="rule family=ipv4 source address=$TEAM_IP/32 port port=8080 protocol=tcp accept"
sudo firewall-cmd --permanent --zone="$ZONE" --remove-rich-rule="rule family=ipv4 source address=$TEAM_IP/32 port port=8080 protocol=tcp accept"
```

이번 검증에서는 운영 방화벽 명령을 실행하지 않는다.

## 적용 후 확인과 복구

- 저장 요청은 유효 토큰으로 200이어야 한다. 반복 401은 인증/대상 버전 불일치로 조사한다. 404는 API 미배포 또는 잘못된 프록시 대상을 확인한다.
- 두 테스트 계정으로 준비/시작, 언어별 문제, 실제 빌드, 초안 저장/새로고침, 제출/관전, 결과/보상까지 확인한다. 예상한 문법 오류 검증 요청 외의 4xx/5xx를 별도로 확인한다.
- 문제 발생 시 새 경기 시작을 멈추고 프론트·백엔드를 기록한 이전 커밋으로 함께 복구한다. 운영 DB 행을 삭제해 복구하지 않는다. 닉네임 unique는 중복 금지 정책이므로 일반 코드 롤백과 함께 제거하지 않는다.

## Pi 비교 검증 기록 — 학교 배포의 차단 조건 아님

2026-11-05 별도 테스트에서 arm64 실행 이미지 빌드/DB/Valkey는 정상이다. 커널 부팅 옵션의 `cgroup_disable=memory` 때문에 `/sys/fs/cgroup/cgroup.controllers`에 memory가 없고 `/proc/cgroups`에서 memory enabled=0이다. 메모리 제한 컨테이너가 시작되지 않는다. 이 상태에서 실행기는 준비 실패를 반환하고 코드 경기 시작을 차단한다.

해결에는 현재 커널에 맞는 부팅 옵션으로 memory cgroup을 활성화하고 재부팅한 뒤 실제 적용을 확인해야 한다. 운영 부팅 설정과 재부팅은 실행하지 않았다. 원본 설정 백업·실제 부팅 파일 확인·재부팅 시점 검토 후 별도로 적용해야 한다. 이후 controllers에 memory가 나타나는지 확인하고 `gamePreflight.js`, `testIsolatedRunner.js`, 전체 통합 테스트를 다시 실행한다. 제한을 제거한 컨테이너를 사용자 코드 실행에 사용하지 않는다.

### Pi 적용 제안 — 참고용, 현재 실행 범위에서 제외

- 확인한 커널: `6.6.77-8.el10.altarch.aarch64+4k`. 확인한 파일: `/boot/efi/cmdline.txt`. 여기에 cgroup 관련 인자는 없다. `/proc/cmdline`에 비활성화 인자가 나타나므로 파일에서 해당 문자열을 삭제하는 방식은 맞지 않는다.
- 제안: 이 파일을 별도 이름으로 백업하고, 기존 한 줄의 인자를 유지하면서 끝에 `cgroup_enable=memory`를 추가한 뒤 재부팅한다. Raspberry Pi 측은 DT 기본 비활성화를 이 인자로 덮어쓰는 방식을 설명한다. 적용 가능 여부는 이 호스트의 재부팅 후 검사해야 한다. [Raspberry Pi 커널 유지보수자 설명](https://github.com/raspberrypi/linux/issues/6980), [해당 인자 처리 소스](https://raw.githubusercontent.com/raspberrypi/linux/rpi-6.6.y/kernel/cgroup/cgroup.c).
- 영향: Pi 전체가 재부팅되어 DB/Valkey 및 다른 사용자의 프로세스도 일시 중단된다. 테스트 프로세스는 자동 시작 서비스가 아니므로 별도 환경의 Valkey/백엔드를 다시 시작해야 한다. 운영 npm 프로세스와 서비스 등록은 변경하지 않는다.
- 통과 기준: cgroup.controllers에 memory 존재, memory.max 402653184가 컨테이너 안에서 확인됨, 사전 점검·43개 템플릿·통합 묶음·실제 게임 재검증 통과.
- 복구: 백업한 cmdline.txt를 원래 경로로 되돌리고 재부팅한다. 이 제안의 백업/편집/재부팅 명령은 실행하지 않았다.
