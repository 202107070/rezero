# re:zero 프론트 → 백엔드 연동 가이드

> **목적**: 백엔드(DB·API·소켓) 작업 전, 프론트가 실제로 쓰는 데이터를 **테이블 / API / 실시간 / 클라이언트 전용**으로 나눠 정리한 문서  
> **소스 오브 트루스**: `src/types/*.ts`, `data-dictionary.txt`, `front.txt`  
> **현재 상태**: 프론트는 메모리 store + localStorage mock. 백엔드 API는 거의 미구현( `/api/v1/build/session/*` stub만 존재).

---

## 목차

1. [전체 데이터 흐름](#1-전체-데이터-흐름)
2. [DB 테이블 설계 (영구 저장)](#2-db-테이블-설계-영구-저장)
3. [Redis / 세션 저장 (임시·실시간)](#3-redis--세션-저장-임시실시간)
4. [REST API 명세](#4-rest-api-명세)
5. [WebSocket 이벤트 (제안)](#5-websocket-이벤트-제안)
6. [클라이언트 전용 (백엔드 불필요)](#6-클라이언트-전용-백엔드-불필요)
7. [enum · 상수 · 비즈니스 규칙](#7-enum--상수--비즈니스-규칙)
8. [화면별 API 호출 시점](#8-화면별-api-호출-시점)

---

## 1. 전체 데이터 흐름

```
[로그인] → users 테이블 검증 → JWT/세션
    ↓
[로비] → GET /rooms, GET /users/me (gold/items/titles/history)
    ↓
[방 생성/입장] → POST /rooms, WS room:join
    ↓
[대기실 READY] → WS room:ready, room:chat
    ↓
[게임 START] → POST /matches/start → problems 선정 → battle session 생성
    ↓
[배틀 중] → POST /build/session/save (draft), WS battle:progress
    ↓
[배틀 종료] → POST /matches/{id}/submit → ranking 계산
    ↓
[결과 화면] → POST /users/me/match-history, PATCH /users/me (gold/titles/rating)
    ↓
[매치 스토리] → GET /users/me/match-history
```

### sessionId 규칙 (프론트 고정)

| 조건 | sessionId |
|------|-----------|
| roomId 있음 | `battle-{roomId}` (예: `battle-5`) |
| roomId 없음 (solo) | `battle-solo` |

---

## 2. DB 테이블 설계 (영구 저장)

### 2.1 `users` — 계정·프로필

**프론트 출처**: `authService.AuthUser`, `userService`

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| `id` | VARCHAR(64) PK | NO | `user_{timestamp}` 또는 `test_user_1` |
| `username` | VARCHAR(32) UNIQUE | NO | 로그인 ID. 소문자 정규화 |
| `password_hash` | VARCHAR(255) | NO | 평문 저장 금지 (현재 mock은 평문) |
| `display_name` | VARCHAR(20) | NO | 게임 표시 닉네임 |
| `gold` | INT UNSIGNED | NO | 기본 0. 정답 1문제 = +100G |
| `rating_score` | INT | NO | 기본 1000. UI 거의 미표시 |
| `created_at` | TIMESTAMP | NO | |
| `updated_at` | TIMESTAMP | NO | |

**회원가입 검증 규칙** (`authService.signup`):
- username: 3자+, `[a-z0-9_]` 만
- password: 4자+
- displayName: trim, 없으면 username, max 20

**로그인 응답에 포함할 필드** (프론트 hydrate용):
```json
{
  "id": "user_1720000000000",
  "username": "player1",
  "displayName": "플레이어1",
  "gold": 0,
  "ratingScore": 1000
}
```

---

### 2.2 `user_items` — 배틀 아이템 보유량

**프론트 출처**: `userService.itemInventory`, `constants/itemTypes.ts`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | FK → users | |
| `item_key` | ENUM | 8종 (아래 enum 참고) |
| `quantity` | INT UNSIGNED | 기본 0 |

**8종 item_key** (camelCase 그대로 API에 사용):
`paint`, `revealLength`, `revealPrev`, `lightning`, `timeReduce`, `scribble`, `blankBreak`, `buildCharge`

**대안**: users 테이블에 JSON 컬럼 `item_inventory` 로 한 row에 저장 (프론트 구조와 1:1)

```json
{
  "paint": 0, "revealLength": 0, "revealPrev": 0,
  "lightning": 0, "timeReduce": 0, "scribble": 0,
  "blankBreak": 0, "buildCharge": 0
}
```

**변경 시점**:
- 로비 룰렛: `-1000G`, 당첨 item `+1` (또는 miss)
- 배틀 시작(item 모드): 선택한 item `-1` (대기실 로드아웃)
- 배틀 중 item 사용: `-1`

---

### 2.3 `user_titles` — 칭호 보유·장착

**프론트 출처**: `constants/titleTypes.ts` → `TitleData`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | FK | |
| `owned_title_ids` | JSON / 별도 M:N | 보유 칭호 id 배열 |
| `equipped_title_id` | VARCHAR(32) NULL | 장착 중인 칭호 id |
| `stats_total_wins` | INT | |
| `stats_consecutive_wins` | INT | |
| `stats_total_games` | INT | |
| `stats_perfect_game` | BOOLEAN | 한 판 전문제 정답 이력 |
| `stats_avg_speed` | FLOAT | 평균 풀이 속도(초) |
| `stats_lang_wins` | JSON | `{ "JAVA": 3, "PYTHON": 1 }` |

**칭호 마스터 id** (서버 상수, DB seed 불필요):
`rookie`, `streak3`, `streak5`, `veteran`, `perfect`, `java_master`, `python_master`, `cpp_master`, `speedster`, `all_rounder`

**해금 조건**: 프론트 `TITLE_DEFS[].check(stats)` — 서버에서 동일 로직 구현 또는 결과 POST 시 서버가 계산

**갱신 시점**: `ResultPage` 마운트 시
- `totalGames += 1`
- 승리(상위 ceil(n/2)): `totalWins += 1`, `consecutiveWins += 1`, `langWins[lang] += 1`
- 패배: `consecutiveWins = 0`
- 전문제 정답: `perfectGame = true`

---

### 2.4 `match_code_history` — 매치 스토리 ★

**프론트 출처**: `types/lobby.ts` → `CodeHistoryEntry`, `ResultPage` useEffect

> **한 줄 요약**: 배틀 1판 끝날 때마다, 그 판의 **문제 목록 + 내 제출 코드**를 유저별로 저장. 로비/유저 메뉴의 "매치 스토리"에서 열람·삭제.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `history_id` | VARCHAR(128) PK | `{roomId}::{submittedAt}` 형식 |
| `user_id` | FK → users | 소유자 |
| `room_id` | VARCHAR(32) | 방 ID. solo면 `''` 또는 `solo` |
| `submitted_at` | TIMESTAMP | ISO8601 |
| `lang` | VARCHAR(16) | `JAVA`, `PYTHON`, `CPP` 등 |
| `mode` | VARCHAR(16) NULL | `1/1`, `1/N` 등. **`PRACTICE`면 목록 제외** |
| `code` | TEXT | 대표 코드 1개 |
| `codes` | JSON | `string[]` 문제별 제출 코드/답안 |
| `problems` | JSON | 문제 메타 배열 (아래 스키마) |

**`problems` JSON 요소 스키마** (매치 스토리 UI가 실제 사용하는 필드):

```json
{
  "id": "E01",
  "title": "정수형 변수",
  "question": "정수 값을 저장할 변수를 선언하는...",
  "explanation": "정수형 변수를 선언할 때 int 키워드를 사용합니다.",
  "answer": { "JAVA": ["int"], "PYTHON": ["int"], "CPP": ["int"] },
  "lang": "JAVA"
}
```

| 필드 | 필수 | UI 용도 |
|------|------|---------|
| `title` | 권장 | 목록·상세 헤더 |
| `question` | 권장 | 문제 설명 표시 |
| `explanation` | 권장 | 해설 박스 |
| `answer` | **강력 권장** | 정답 표시 (`getSolution`) |
| `id` | 권장 | answer 없을 때 problems.js fallback |
| `visual`, `options` | 불필요 | 매치 스토리 UI 미사용 |

**비즈니스 규칙**:
1. `mode = 'PRACTICE'` 또는 `room_id = 'PRACTICE'` → GET 목록에서 **제외**
2. 유저당 **최대 50건**. 초과 시 오래된 것 삭제
3. `history_id` 중복 → upsert (같은 판 재저장 방지)
4. 정렬: `submitted_at` **내림차순**

**저장 트리거**: `ResultPage` 마운트 → `battleSubmission`을 `CodeHistoryEntry`로 변환

**원본 데이터** (`persistBattleSubmission`):
```typescript
{
  historyId, roomId, lang, submittedAt, mode,
  problems: BattleProblem[],  // 전체 문제 객체
  codes: string[],             // = answers
  code: string,
}
```

---

### 2.5 `rooms` — 로비 방 목록

**프론트 출처**: `types/lobby.ts` → `Room`, `roomStore`, `roomService.createRoom`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT PK AUTO | 프론트: max(id)+1, 최소 5 |
| `title` | VARCHAR(100) | 방 제목 |
| `status` | ENUM | `WAITING` \| `STARTED` |
| `mode` | ENUM | `1/1` \| `1/N` |
| `game_mode` | ENUM | `item` \| `normal` |
| `difficulty` | VARCHAR(16) | `쉬움`/`보통`/`어려움` 또는 `EASY`/`NORMAL`/`HARD` |
| `language` | VARCHAR(16) | `JAVA`, `PYTHON`, … |
| `password` | VARCHAR(64) | public이면 `''` |
| `problem_count` | TINYINT | 3~10 |
| `max_players` | TINYINT | 1(1/1) 또는 8(1/N) |
| `host_user_id` | FK → users | 방장 |
| `created_at` | BIGINT/TIMESTAMP | ms 또는 ISO |

**표시용 `players` 필드** (`"1/8"`): DB에 저장하지 않고 **참가자 수 집계**로 계산
```
players_display = "{current_count}/{max_players}"
current_count = room_participants WHERE left_at IS NULL
```

**방 생성 입력** (`CreateRoomParams`):
```typescript
{
  roomTitle: string;
  playerMode: '1/1' | '1/N';
  gameMode: 'item' | 'normal';
  difficulty: string;
  language: string;
  roomPwd: string;
  problemCount: string;  // "3"~"10"
}
```

**방 시작 조건** (`roomStartValidation.ts`):
- 1/1: 최소 2명
- 1/N: 최소 3명
- 호스트 제외 전원 `isReady = true`

---

### 2.6 `room_participants` — 대기실 슬롯

**프론트 출처**: `types/room.ts` → `RoomPlayer`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | |
| `room_id` | FK → rooms | |
| `user_id` | FK → users | |
| `slot_index` | TINYINT | 0~7 (8슬롯) |
| `is_host` | BOOLEAN | |
| `is_ready` | BOOLEAN | |
| `language` | VARCHAR(16) | 표시용 (☕ 등) |
| `character` | VARCHAR(16) | `char1`~`char4` |
| `status` | VARCHAR(16) | `HOST` \| `READY` \| `WAITING` |
| `selected_items` | JSON NULL | item 모드: `ItemKey[]` |
| `joined_at` | TIMESTAMP | |
| `left_at` | TIMESTAMP NULL | 퇴장/강퇴 시 |

**강퇴 카운트** (`roomStore.kickedCountByRoom`): Redis 또는 room 메타에 `{roomId: count}` — 인원 표시 보정용

---

### 2.7 `problems` — 문제 은행 (CMS)

**프론트 출처**: `src/data/problems.js`, `types/battle.ts` → `BattleProblem`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(16) PK | `E01`, `M15` 등 |
| `type` | VARCHAR(32) | `fill_blank`, `visual_fill_blank`, `multiple_choice`, `short_answer` |
| `difficulty` | ENUM | `easy`, `medium`, `hard` |
| `title` | VARCHAR(200) | |
| `question` | TEXT | |
| `answer` | JSON | `{ "JAVA": ["int"], "PYTHON": ["int"] }` |
| `options` | JSON NULL | 객관식 선택지 |
| `correct_index` | TINYINT NULL | 객관식 정답 index |
| `explanation` | TEXT | |
| `description` | TEXT NULL | |
| `input` | TEXT NULL | |
| `output` | TEXT NULL | |
| `visual` | JSON NULL | `ProblemVisual` |
| `capability_overrides` | JSON NULL | 문제별 아이템 예외 |

> **참고**: `hasVisual`, `canUseHint` 등은 DB에 저장하지 않음. 프론트가 `type + visual + gameMode`로 `resolveProblemCapabilities()` 계산.

**문제 선정 로직** (`battlePrepService.prepareBattleStart` — 현재 프론트 로컬):
1. difficulty 매칭 (쉬움→easy, 보통→medium, 어려움→hard)
2. language 매칭 (`answer`에 해당 lang 키 존재)
3. `random` lang이면 lang 필터 skip
4. count개 랜덤 추출 (중복 없이, pool 소진 시 재사용)
5. → **백엔드 `POST /matches/start`에서 동일 로직 구현 권장**

---

### 2.8 `matches` — 매치(배틀) 세션 메타

**프론트 출처**: `sessionStore.battleSettings`, `battleSubmission`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(64) PK | sessionId (`battle-5`) |
| `room_id` | FK NULL | |
| `status` | ENUM | `IN_PROGRESS` \| `FINISHED` \| `ABANDONED` |
| `lang` | VARCHAR(16) | |
| `difficulty` | VARCHAR(16) | |
| `problem_count` | TINYINT | |
| `max_players` | TINYINT | |
| `room_mode` | VARCHAR(8) | `1/1` \| `1/N` |
| `game_mode` | ENUM | `item` \| `normal` |
| `round_seconds` | INT | 제한 시간(초) |
| `started_at` | TIMESTAMP | |
| `finished_at` | TIMESTAMP NULL | |

---

### 2.9 `match_problems` — 매치에 배정된 문제

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `match_id` | FK | |
| `problem_index` | TINYINT | 0-based |
| `problem_id` | FK → problems | |
| `problem_snapshot` | JSON | 배틀 시작 시점 문제 전체 복사 (변경 대비) |

---

### 2.10 `match_submissions` — 플레이어별 제출·점수

**프론트 출처**: `persistBattleSubmission`, `ResultPage`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | BIGINT PK | |
| `match_id` | FK | |
| `user_id` | FK | |
| `ingame_score` | INT | 정답 수 × 100 |
| `rating_score_before` | INT | |
| `rating_delta` | INT | 승 +max(10,floor(score/10)), 패 -동일 |
| `codes` | JSON | `string[]` |
| `blank_answers` | JSON NULL | `string[][]` |
| `selected_options` | JSON NULL | `{ "0": 2, "1": 0 }` |
| `solve_times` | JSON | `{ "0": 12.5, "1": 8.3 }` (index→초) |
| `problem_results` | JSON | `boolean[]` |
| `solved_problems` | JSON | `number[]` (index[]) |
| `total_solve_time` | FLOAT | |
| `completion_time` | FLOAT | |
| `finished_at_elapsed` | FLOAT NULL | |
| `submitted_at` | TIMESTAMP | |

---

### 2.11 `match_rankings` — 최종 순위 스냅샷

**프론트 출처**: `FinalRankingSnapshot` (`utils/battle/rankUtils.ts`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `match_id` | FK PK | |
| `finalized_at` | TIMESTAMP | |
| `elapsed_sec` | INT | |
| `round_seconds` | INT | |
| `total_problems` | INT | |
| `rankings_json` | JSON | `RankingPlayerSnapshot[]` |

**RankingPlayerSnapshot**:
```typescript
{
  id: string;           // user id
  name: string;
  avatar: string;
  ingameScore: number;
  ratingScore: number;
  totalSolveTime: number;
  completionTime: number;
  solvedProblems: number[];
  problemResults: boolean[];
  rank: number;       // 1-based
}
```

**순위 비교 규칙** (`comparePlayersByRank`):
1. `ingameScore` 내림차순
2. `completionTime` 오름차순
3. `totalSolveTime` 오름차순

---

### 2.12 `friends` — 친구 관계

**프론트 출처**: `friendStore`, `types/friend.ts`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | FK | 요청者 |
| `friend_user_id` | FK | 친구 |
| `added_at` | TIMESTAMP | |

UNIQUE (`user_id`, `friend_user_id`)

> 현재 프론트는 `name`(displayName)으로 친구 추가 → 백엔드는 **user_id 기반**으로 전환 필요

---

### 2.13 `review_invites` — 결과 화면 복습 초대

**프론트 출처**: `reviewSessionService.ReviewInvitePayload`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | VARCHAR(64) PK | `review-{timestamp}-{random}` |
| `session_id` | VARCHAR(64) | match sessionId |
| `from_user_id` | FK | |
| `to_user_id` | FK | |
| `problem_indices` | JSON | `number[]` |
| `status` | ENUM | `pending` \| `accepted` \| `rejected` \| `cancelled` |
| `created_at` | TIMESTAMP | |

---

### 2.14 ER 관계 요약

```
users ─┬─ user_items (1:N 또는 JSON)
       ├─ user_titles (1:1)
       ├─ match_code_history (1:N)
       ├─ room_participants (1:N)
       ├─ match_submissions (1:N)
       ├─ friends (M:N self)
       └─ review_invites (1:N from/to)

rooms ─┬─ room_participants (1:N)
       └─ matches (1:N)

matches ─┬─ match_problems (1:N)
         ├─ match_submissions (1:N)
         └─ match_rankings (1:1)

problems ─ match_problems (1:N)
```

---

## 3. Redis / 세션 저장 (임시·실시간)

**프론트 출처**: `sessionStore.ts` — 현재 메모리 Map. 멀티플레이·재접속·배틀 중 이어하기용.

| Redis Key | TTL | 내용 | 프론트 함수 |
|-----------|-----|------|-------------|
| `battle:draft:{sessionId}` | 24h | 진행 중 답안 draft | `setBattleDraft` |
| `battle:draft:codes:{sessionId}` | 24h | `string[]` 코드 | `setBattleDraftCodes` |
| `battle:draft:meta:{sessionId}` | 24h | currentIndex, remaining | `setBattleDraftMeta` |
| `battle:demo:{sessionId}` | 1h | 봇·관전 demo 상태 | `setBattleDemoState` |
| `battle:submitted:{sessionId}` | 1h | 제출 완료 problem index[] | `setBattleSubmittedProblems` |
| `presence:{userId}` | 5m | FriendPresence | `setUserPresence` |
| `room:kicked:{roomId}` | - | 강퇴 누적 수 | `setKickedCount` |

### battle:draft 스키마

```json
{
  "roomId": "5",
  "sessionId": "battle-5",
  "lang": "java",
  "currentIndex": 2,
  "remaining": 1800,
  "answers": ["int", "for", ""],
  "problems": [ "...BattleProblem[]..." ],
  "snapshot": "int||for||",
  "updatedAt": "2026-07-11T00:00:00.000Z"
}
```

### battle:demo 스키마 (결과 화면에서도 읽음)

```json
{
  "roomId": "5",
  "sessionId": "battle-5",
  "mode": "1/N",
  "maxPlayers": "8",
  "lang": "JAVA",
  "currentIndex": 4,
  "remaining": 0,
  "roundSeconds": 2700,
  "answers": ["..."],
  "localSolvedProblems": [0, 1, 2],
  "finishedAtElapsedSec": 2450,
  "demoSpectating": false,
  "spectatorLocked": false,
  "battleBots": [ "...DemoBot[]..." ],
  "ingameScore": 300,
  "solveTimes": { "0": 45, "1": 30 },
  "problemResults": [true, true, false],
  "myRatingScore": 1000,
  "blankAnswers": [["int"], ["for"]],
  "selectedOptions": { "2": 0 },
  "updatedAt": "2026-07-11T00:30:00.000Z"
}
```

---

## 4. REST API 명세

> Base URL: `/api/v1`  
> 인증: `Authorization: Bearer {token}` (로그인 제외)

---

### 4.1 인증 (`authService`)

#### POST `/auth/signup`

**Request**
```json
{
  "username": "player1",
  "password": "1234",
  "displayName": "플레이어1"
}
```

**Response 201**
```json
{
  "user": { "id": "...", "username": "player1", "displayName": "플레이어1" },
  "token": "..."
}
```

**Error**: 400 (검증 실패), 409 (중복 username)

---

#### POST `/auth/login`

**Request**
```json
{ "username": "player1", "password": "1234" }
```

**Response 200**
```json
{
  "user": {
    "id": "user_1720000000000",
    "username": "player1",
    "displayName": "플레이어1",
    "gold": 50000,
    "ratingScore": 1000,
    "itemInventory": { "paint": 10, "...": 0 },
    "titleData": {
      "owned": [],
      "equipped": null,
      "stats": { "totalWins": 0, "consecutiveWins": 0, "totalGames": 0, "perfectGame": false, "avgSpeed": 0, "langWins": {} }
    }
  },
  "token": "..."
}
```

> 로그인 성공 시 프론트 `initializeUserSession()` 호출 — gold/items를 서버 값으로 덮어씀

---

#### POST `/auth/logout`
- 세션/토큰 무효화

---

### 4.2 유저 프로필 (`userService`)

#### GET `/users/me`
로그인 응답과 동일한 프로필 전체

#### PATCH `/users/me`
부분 갱신 (결과 화면 후 batch 가능)

**Request 예시**
```json
{
  "gold": 50300,
  "ratingScore": 1030,
  "titleData": {
    "owned": ["rookie"],
    "equipped": "rookie",
    "stats": { "totalWins": 1, "consecutiveWins": 1, "totalGames": 1, "perfectGame": false, "avgSpeed": 0, "langWins": { "JAVA": 1 } }
  },
  "itemInventory": { "paint": 9, "...": 0 }
}
```

---

### 4.3 매치 스토리 ★ (`CodeHistoryEntry`)

#### GET `/users/me/match-history`

**Query**: 없음 (프론트가 클라이언트 정렬)

**Response 200**
```json
{
  "items": [
    {
      "historyId": "5::2026-07-11T00:37:00.000Z",
      "roomId": "5",
      "submittedAt": "2026-07-11T00:37:00.000Z",
      "lang": "JAVA",
      "mode": "1/N",
      "problems": [
        {
          "id": "E01",
          "title": "정수형 변수",
          "question": "...",
          "explanation": "...",
          "answer": { "JAVA": ["int"] }
        }
      ],
      "codes": ["int", "for", "3"],
      "code": "int"
    }
  ]
}
```

**서버 필터**: `mode != 'PRACTICE' AND room_id != 'PRACTICE'`, `submitted_at DESC`, max 50

---

#### POST `/users/me/match-history`

**트리거**: `ResultPage` 마운트 (submission.submittedAt 있을 때)

**Request**: GET item 1건과 동일 구조

**Response**: 201 Created

**서버 처리**:
1. historyId 중복 → upsert
2. 50건 초과 → 오래된 것 삭제

---

#### DELETE `/users/me/match-history`

**Request**
```json
{ "historyIds": ["5::2026-07-11T00:37:00.000Z", "..."] }
```

**트리거**: `MatchStoryModal` → [선택 삭제]

---

### 4.4 방 (`roomService`, `roomStore`)

#### GET `/rooms`

**Query** (RoomFilterState — 전부 optional, AND 조건):
| param | 예시 |
|-------|------|
| `playerModes` | `1/1,1/N` |
| `difficulties` | `보통,어려움` |
| `languages` | `JAVA,PYTHON` |
| `problemCounts` | `5,10` |
| `gameModes` | `item,normal` |
| `visibility` | `public,private` |

**Response**
```json
{
  "rooms": [
    {
      "id": 5,
      "title": "내 방",
      "status": "WAITING",
      "players": "2/8",
      "mode": "1/N",
      "gameMode": "item",
      "diff": "보통",
      "lang": "JAVA",
      "pwd": "",
      "count": "5",
      "createdAt": 1720000000000
    }
  ]
}
```

---

#### POST `/rooms`

**Request** (CreateRoomParams)
```json
{
  "roomTitle": "알고리즘 배틀",
  "playerMode": "1/N",
  "gameMode": "item",
  "difficulty": "보통",
  "language": "JAVA",
  "roomPwd": "",
  "problemCount": "5"
}
```

**Response 201**: Room 객체 + `host` 자동 room_participants INSERT

---

#### GET `/rooms/{id}`
방 상세 + participants[]

#### DELETE `/rooms/{id}`
방장만. status=WAITING 일 때만

#### PATCH `/rooms/{id}/status`
`{ "status": "STARTED" }` — 게임 시작 시

---

### 4.5 대기실 참가자

#### POST `/rooms/{id}/join`

**Request**
```json
{
  "password": "",
  "language": "☕",
  "character": "char1"
}
```

#### POST `/rooms/{id}/leave`

#### PATCH `/rooms/{id}/ready`
```json
{ "isReady": true }
```

#### PATCH `/rooms/{id}/loadout` (item 모드)
```json
{ "selectedItems": ["paint", "lightning", "revealLength"] }
```

#### POST `/rooms/{id}/kick`
```json
{ "targetUserId": "..." }
```

---

### 4.6 매치 / 배틀

#### POST `/matches/start`

**트리거**: 대기실 [START] → `prepareBattleStart()`

**Request**
```json
{
  "roomId": "5",
  "lang": "JAVA",
  "difficulty": "NORMAL",
  "problemCount": 5,
  "maxPlayers": 8,
  "roomMode": "1/N",
  "gameMode": "item",
  "selectedItems": ["paint", "lightning"],
  "roomRoster": [
    { "id": 1, "name": "player1", "character": "char1", "isHost": true }
  ]
}
```

**Response**
```json
{
  "sessionId": "battle-5",
  "problems": [ "...BattleProblem[]..." ],
  "roundSeconds": 2700,
  "settings": {
    "roomId": "5",
    "lang": "JAVA",
    "diff": "NORMAL",
    "count": "5",
    "maxPlayers": "8",
    "roomMode": "1/N",
    "gameMode": "item",
    "selectedItems": ["paint", "lightning"],
    "roomRoster": [ "..." ]
  }
}
```

---

#### POST `/matches/{sessionId}/submit`

**트리거**: 배틀 종료 → `persistBattleSubmission()`

**Request**
```json
{
  "roomId": "5",
  "problems": [ "..." ],
  "answers": ["int", "for", "3"],
  "codes": ["int", "for", "3"],
  "code": "3",
  "lang": "JAVA",
  "mode": "1/N",
  "maxPlayers": "8",
  "currentIndex": 4,
  "ingameScore": 300,
  "solveTimes": { "0": 45, "1": 30, "2": 60 },
  "problemResults": [true, true, true, false, false],
  "blankAnswers": [["int"], ["for"], ["3"], [], []],
  "selectedOptions": {},
  "myRatingScore": 1000,
  "remaining": 0,
  "roundSeconds": 2700,
  "localSolvedProblems": [0, 1, 2],
  "finishedAtElapsedSec": 2450
}
```

**Response**
```json
{
  "ranking": { "...FinalRankingSnapshot..." },
  "earnedGold": 300,
  "ratingDelta": 30,
  "newTitleIds": ["rookie"]
}
```

---

#### GET `/matches/{sessionId}/ranking`
결과 화면 재진입용

---

### 4.7 빌드 세션 (이미 프론트 호출 중)

#### POST `/build/session/save`

**트리거**: 배틀 중 autosave → `persistBattleSession()`

**Request** (프론트 실제 body)
```json
{
  "sessionId": "battle-5",
  "userId": "user_1720000000000",
  "language": "java",
  "roomId": "5",
  "status": "BATTLE",
  "currentIndex": "2",
  "remaining": "1800",
  "problems": [
    {
      "title": "정수형 변수",
      "description": "",
      "input": "",
      "output": "",
      "code": "int"
    }
  ]
}
```

**Response**: 200 OK

---

#### DELETE `/build/session/{sessionId}`

**트리거**: 배틀 나가기 → `clearBattleAndLeave()`

---

### 4.8 문제

#### GET `/problems`
CMS용. difficulty, lang, type 필터

#### GET `/problems/{id}`
단일 문제

> 초기 MVP: `problems.js`를 그대로 서빙해도 됨

---

### 4.9 친구

#### GET `/friends`
#### POST `/friends`
```json
{ "friendUserId": "..." }
```
또는 `{ "friendUsername": "..." }`

#### DELETE `/friends/{friendUserId}`

#### GET `/friends/presence`
FriendPresence[]

---

### 4.10 리뷰 초대

#### POST `/review/invites`
```json
{
  "sessionId": "battle-5",
  "toUserId": "...",
  "problemIndices": [0, 2, 4]
}
```

#### PATCH `/review/invites/{id}`
```json
{ "status": "accepted" }
```

---

### 4.11 룰렛 (로비)

#### POST `/users/me/roulette/spin`

**비용**: 1000G  
**Response**
```json
{
  "result": "paint",
  "gold": 49000,
  "itemInventory": { "paint": 11, "...": 0 }
}
```
`result` = ItemKey | `"miss"`

---

## 5. WebSocket 이벤트 (제안)

백엔드 `src/sockets/` 폴더 존재. 프론트는 아직 미연동 — 멀티플레이 시 필요.

### Room namespace

| Event | Direction | Payload |
|-------|-----------|---------|
| `room:join` | C→S | `{ roomId, userId }` |
| `room:leave` | C→S | `{ roomId, userId }` |
| `room:player_update` | S→ALL | `RoomPlayer` |
| `room:ready` | C→S | `{ roomId, userId, isReady }` |
| `room:chat` | C→S→ALL | `{ roomId, sender, text, mode }` |
| `room:start` | S→ALL | `{ sessionId, problems[] }` |
| `room:kick` | S→target | `{ roomId, reason }` |

### Lobby namespace

| Event | Direction | Payload |
|-------|-----------|---------|
| `lobby:chat` | C→S→ALL | `ChatMessage` |
| `lobby:users` | S→ALL | `LobbyUser[]` |
| `presence:update` | S→friends | `FriendPresence` |

### Battle namespace

| Event | Direction | Payload |
|-------|-----------|---------|
| `battle:progress` | C→S→ALL | `{ sessionId, userId, problem, solvedCount, ingameScore }` |
| `battle:item_use` | C→S→ALL | `{ sessionId, userId, itemKey, targetUserId? }` |
| `battle:finish` | S→ALL | `{ sessionId, ranking }` |

---

## 6. 클라이언트 전용 (백엔드 불필요)

| 데이터 | 저장 위치 | 설명 |
|--------|-----------|------|
| 모달 open/close, `wheelDeg`, `selectedHistoryIndex` | React state | UI만 |
| `displayMode`, `audioSettings` | clientPrefsStore (메모리) | Electron 창/BGM 설정 |
| 로비 채팅 (현재) | LobbyPage state | 서버 연동 전 mock |
| AI 리뷰어 채팅 | ResultPage state | 로컬 mock |
| URL 쿼리 파라미터 | 브라우저 URL | 화면 간 전달용. DB 대체 아님 |
| `problems.js` (정적) | 프론트 bundle | CMS 전까지 서버 불필요 |

### URL 쿼리 (화면 간 전달, API 아님)

| Route | Params |
|-------|--------|
| `/room` | id, title, mode, diff, lang, pwd, count, maxPlayers, gameMode |
| `/battle` | fresh, roomId, lang, mode, count, maxPlayers, gameMode |
| `/result` | roomId |
| `/practice` | lang, diff, count, type? |
| `/build` | (없음) |

---

## 7. enum · 상수 · 비즈니스 규칙

### 7.1 enum

| 이름 | 값 |
|------|-----|
| GameMode | `item`, `normal` |
| RoomStatus | `WAITING`, `STARTED` |
| PlayerMode | `1/1`, `1/N` |
| Difficulty (한글) | `쉬움`, `보통`, `어려움` |
| Difficulty (영문) | `EASY`, `NORMAL`, `HARD` |
| Language | `JAVA`, `PYTHON`, `CPP`, `HTML`, `CSS` |
| Character | `char1`, `char2`, `char3`, `char4` |
| ProblemType | `fill_blank`, `visual_fill_blank`, `multiple_choice`, `short_answer` |
| ProblemDifficulty | `easy`, `medium`, `hard` |
| FriendPresenceStatus | `lobby`, `room`, `offline` |
| ReviewInviteStatus | `pending`, `accepted`, `rejected`, `cancelled` |
| MatchStatus | `IN_PROGRESS`, `FINISHED`, `ABANDONED` |

### 7.2 점수·보상

| 상수 | 값 | 설명 |
|------|-----|------|
| BATTLE_CORRECT_SCORE | 100 | 정답 1문제 = ingameScore +100 = gold +100 |
| ROULETTE_COST | 1000 G | |
| Rating delta | max(10, floor(ingameScore/10)) | 상위 ceil(n/2) 승: +, 하위 패: - |
| Match history max | 50건 | |
| Battle build limit | 3회 | BATTLE_BUILD_LIMIT |
| Build item bonus | +3 | BATTLE_BUILD_ITEM_BONUS |

### 7.3 언어 매핑

```
JAVA → java, PYTHON → python, C++ → cpp, HTML → html, CSS → css
쉬움 → EASY, 보통 → NORMAL, 어려움 → HARD
```

### 7.4 티어 (현재 mock — rating 연동 후 서버 계산 권장)

브론즈 < 실버 < 골드 < 플래티넘 < 다이아 < 마스터  
현재 `tierUtils.ts`는 username 하드코딩 map

---

## 8. 화면별 API 호출 시점

| 화면 | 시점 | API |
|------|------|-----|
| LoginPage | 회원가입 | POST /auth/signup |
| LoginPage | 로그인 | POST /auth/login |
| LobbyPage | 마운트 | GET /rooms, GET /users/me |
| LobbyPage | 방 만들기 | POST /rooms → navigate /room?... |
| LobbyPage | 매치 스토리 열기 | GET /users/me/match-history |
| LobbyPage | 매치 스토리 삭제 | DELETE /users/me/match-history |
| LobbyPage | 룰렛 | POST /users/me/roulette/spin |
| LobbyPage | 칭호 장착 | PATCH /users/me (titleData) |
| RoomPage | 입장 | POST /rooms/{id}/join |
| RoomPage | READY | PATCH /rooms/{id}/ready |
| RoomPage | START | POST /matches/start |
| BattlePage | autosave | POST /build/session/save |
| BattlePage | 종료 | POST /matches/{id}/submit |
| BattlePage | 나가기 | DELETE /build/session/{id} |
| ResultPage | 마운트 | GET /matches/{id}/ranking |
| ResultPage | 마운트 | POST /users/me/match-history |
| ResultPage | 마운트 | PATCH /users/me (gold, titles, rating) |
| ResultPage | 복습 초대 | POST /review/invites |
| PracticePage | — | **API 없음** (로컬 only, PRACTICE는 history 제외) |
| BuildPage | — | **API 없음** (로컬 only) |

---

## 부록 A: 프론트 store → DB/API 매핑 한눈표

| 프론트 (현재) | 저장소 | → 백엔드 |
|---------------|--------|----------|
| authService accounts | localStorage | users |
| currentUser | 메모리 | JWT session |
| userService.gold | 메모리 | users.gold |
| userService.itemInventory | 메모리 | user_items / JSON |
| userService.titleData | 메모리 | user_titles |
| userService.codeHistory | 메모리 | match_code_history |
| userService.ratingScore | 메모리 | users.rating_score |
| roomStore.dynamicRooms | 메모리 | rooms |
| roomStore.kickedCount | 메모리 Map | Redis room:kicked |
| sessionStore.battle* | 메모리 Map | Redis + matches |
| friendStore | localStorage | friends + Redis presence |
| reviewInviteStore | 메모리 Map | review_invites |
| clientPrefsStore | 메모리 | (클라이언트 only) |
| problems.js | 정적 파일 | problems 테이블 |

---

## 부록 B: 타입 파일 위치

| 타입 | 파일 |
|------|------|
| Room, CodeHistoryEntry, LobbyUser, GameMode | `src/types/lobby.ts` |
| RoomPlayer, RoomSettings | `src/types/room.ts` |
| BattleProblem, RoomUser, ItemInventory | `src/types/battle.ts` |
| FriendEntry, FriendPresence | `src/types/friend.ts` |
| RoomFilterState | `src/types/roomFilter.ts` |
| TitleData, TitleStats | `src/constants/titleTypes.ts` |
| AuthUser | `src/services/authService.ts` |
| FinalRankingSnapshot | `src/utils/battle/rankUtils.ts` |
| ResultPlayer | `src/utils/resultUtils.ts` |
| ReviewInvitePayload | `src/services/reviewSessionService.ts` |

---

*문서 기준: re:zero frontend (2026-07-11). companion: `data-dictionary.txt`, `front.txt`*
