-- 002_create_container_db.sql
-- 1. 출제된 문제 테이블
CREATE TABLE PROBLEM (
    problemID INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    explan TEXT,
    level INTEGER,
    timeLimitSeconds INTEGER
);

-- 2. 게임방 참가자 테이블
CREATE TABLE CHALLENGERS (
    challengerID INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL,
    state INTEGER DEFAULT 0,     -- 0: 대기방 입장, 1: 준비완료(Ready), 2: 대결중
    winOrLose INTEGER DEFAULT 0, -- 0: 패배, 1: 승리
    submitCnt INTEGER DEFAULT 0  -- 실시간 제출 횟수 카운트
);

-- 3. 실시간 채팅 테이블
CREATE TABLE CHAT (
    chatID INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL,
    stateNum INTEGER,            -- 채팅방 유저 상태값 등 확장용
    chatContent TEXT NOT NULL,
    inputTime DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 유저들이 대결 중에 실시간으로 제출하는 소스코드 및 컴파일 결과 기록 테이블
CREATE TABLE MATCH_PROBLEM (
    matchProblemID INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL,
    problemID INTEGER,
    language TEXT,
    sourceCode TEXT,
    compileResult TEXT
);