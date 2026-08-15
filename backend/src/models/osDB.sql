-- 1. users (계정 및 프로필)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY, -- user_{timestamp} 형식
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(20) NOT NULL,
    gold INT UNSIGNED NOT NULL DEFAULT 0,
    rating_score INT NOT NULL DEFAULT 1000,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. user_items (배틀 아이템 보유량)
CREATE TABLE IF NOT EXISTS user_items (
    user_id VARCHAR(64) NOT NULL,
    item_key VARCHAR(20) NOT NULL, -- paint, revealLength 등
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, item_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. user_titles (칭호 보유 및 장착 상태)
CREATE TABLE IF NOT EXISTS user_titles (
    user_id VARCHAR(64) PRIMARY KEY,
    owned_title_ids JSON NOT NULL, -- 배열 형태 ["rookie", "veteran"]
    equipped_title_id VARCHAR(32) NULL,
    stats_total_wins INT NOT NULL DEFAULT 0,
    stats_consecutive_wins INT NOT NULL DEFAULT 0,
    stats_total_games INT NOT NULL DEFAULT 0,
    stats_perfect_game BOOLEAN NOT NULL DEFAULT FALSE,
    stats_avg_speed FLOAT NOT NULL DEFAULT 0,
    stats_lang_wins JSON NOT NULL, -- 객체 형태 {"JAVA": 3, "PYTHON": 1}
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. match_code_history (매치 스토리 - 배틀 1판 종료 후의 전체 기록)
CREATE TABLE IF NOT EXISTS match_code_history (
    history_id VARCHAR(128) PRIMARY KEY, -- {roomId}::{submittedAt}
    user_id VARCHAR(64) NOT NULL,
    room_id VARCHAR(32) NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    lang VARCHAR(16) NOT NULL,
    mode VARCHAR(16),
    code TEXT NOT NULL,
    codes JSON NOT NULL, -- 제출 코드/답안 배열
    problems JSON NOT NULL, -- 문제 메타 배열
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. rooms (방 목록)
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'WAITING', -- WAITING, STARTED
    mode VARCHAR(8) NOT NULL, -- 1/1, 1/N
    game_mode VARCHAR(16) NOT NULL, -- item, normal
    difficulty VARCHAR(16) NOT NULL, -- EASY, NORMAL, HARD 등
    language VARCHAR(16) NOT NULL,
    password VARCHAR(64) NOT NULL DEFAULT '',
    problem_count TINYINT NOT NULL,
    max_players TINYINT NOT NULL,
    host_user_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. room_participants (대기실 슬롯)
CREATE TABLE IF NOT EXISTS room_participants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    slot_index TINYINT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT FALSE,
    is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    language VARCHAR(16),
    `character` VARCHAR(16), -- char1 ~ char4
    status VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    selected_items JSON NULL, -- item 모드 시 선택된 아이템
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. problems (문제 은행 - CMS)
CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(16) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    difficulty VARCHAR(16) NOT NULL, -- easy, medium, hard
    title VARCHAR(200) NOT NULL,
    question TEXT NOT NULL,
    answer JSON NOT NULL,
    options JSON NULL,
    correct_index TINYINT NULL,
    explanation TEXT NOT NULL,
    description TEXT NULL,
    input TEXT NULL,
    output TEXT NULL,
    visual JSON NULL,
    capability_overrides JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. matches (매치 / 배틀 세션 메타)
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY, -- sessionId (예: battle-5)
    room_id INT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, FINISHED, ABANDONED
    lang VARCHAR(16) NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    problem_count TINYINT NOT NULL,
    max_players TINYINT NOT NULL,
    room_mode VARCHAR(8) NOT NULL,
    game_mode VARCHAR(16) NOT NULL,
    round_seconds INT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. match_problems (매치에 배정된 문제)
CREATE TABLE IF NOT EXISTS match_problems (
    match_id VARCHAR(64) NOT NULL,
    problem_index TINYINT NOT NULL,
    problem_id VARCHAR(16) NOT NULL,
    problem_snapshot JSON NOT NULL,
    PRIMARY KEY (match_id, problem_index),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. match_submissions (플레이어별 제출 및 점수)
CREATE TABLE IF NOT EXISTS match_submissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    ingame_score INT NOT NULL DEFAULT 0,
    rating_score_before INT NOT NULL,
    rating_delta INT NOT NULL,
    codes JSON NOT NULL,
    blank_answers JSON NULL,
    selected_options JSON NULL,
    solve_times JSON NOT NULL,
    problem_results JSON NOT NULL,
    solved_problems JSON NOT NULL,
    total_solve_time FLOAT NOT NULL,
    completion_time FLOAT NOT NULL,
    finished_at_elapsed FLOAT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. match_rankings (최종 순위 스냅샷)
CREATE TABLE IF NOT EXISTS match_rankings (
    match_id VARCHAR(64) PRIMARY KEY,
    finalized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    elapsed_sec INT NOT NULL,
    round_seconds INT NOT NULL,
    total_problems INT NOT NULL,
    rankings_json JSON NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. friends (친구 관계)
CREATE TABLE IF NOT EXISTS friends (
    user_id VARCHAR(64) NOT NULL,
    friend_user_id VARCHAR(64) NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. review_invites (결과 화면 복습 초대)
CREATE TABLE IF NOT EXISTS review_invites (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    from_user_id VARCHAR(64) NOT NULL,
    to_user_id VARCHAR(64) NOT NULL,
    problem_indices JSON NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, cancelled
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
