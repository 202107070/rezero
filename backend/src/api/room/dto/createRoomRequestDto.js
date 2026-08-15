import { AppError } from "#utils/appError.js";

const PLAYER_MODES = new Set(["1/1", "1/N"]);
const GAME_MODES = new Set(["normal", "item"]);
const DIFFICULTIES = new Set(["쉬움", "보통", "어려움"]);
const LANGUAGES = new Set(["JAVA", "PYTHON", "C++", "HTML", "CSS", "RANDOM"]);

function invalidRoomRequest(message) {
  return new AppError(400, "INVALID_ROOM_REQUEST", message);
}

export function parseCreateRoomRequest(body = {}) {
  const roomTitle =
    typeof body.roomTitle === "string" ? body.roomTitle.trim() : "";
  const playerMode =
    typeof body.playerMode === "string" ? body.playerMode.trim() : "";
  const gameMode =
    typeof body.gameMode === "string" ? body.gameMode.trim() : "";
  const difficulty =
    typeof body.difficulty === "string" ? body.difficulty.trim() : "";
  const language =
    typeof body.language === "string" ? body.language.trim().toUpperCase() : "";
  const roomPwd = typeof body.roomPwd === "string" ? body.roomPwd : "";
  const problemCount = Number(body.problemCount);

  if (roomTitle.length < 1 || roomTitle.length > 100) {
    throw invalidRoomRequest("방 제목은 1자 이상 100자 이하로 입력해 주세요.");
  }

  if (!PLAYER_MODES.has(playerMode)) {
    throw invalidRoomRequest("대전 방식은 1/1 또는 1/N만 선택할 수 있습니다.");
  }

  if (!GAME_MODES.has(gameMode)) {
    throw invalidRoomRequest(
      "게임 모드는 normal 또는 item만 선택할 수 있습니다.",
    );
  }

  if (!DIFFICULTIES.has(difficulty)) {
    throw invalidRoomRequest(
      "난이도는 쉬움, 보통, 어려움 중에서 선택해 주세요.",
    );
  }

  if (!LANGUAGES.has(language)) {
    throw invalidRoomRequest("지원하지 않는 언어입니다.");
  }

  if (roomPwd.length > 64) {
    throw invalidRoomRequest("방 비밀번호는 64자 이하로 입력해 주세요.");
  }

  if (
    !Number.isInteger(problemCount) ||
    problemCount < 3 ||
    problemCount > 10
  ) {
    throw invalidRoomRequest("문제 수는 3개 이상 10개 이하로 선택해 주세요.");
  }

  return {
    title: roomTitle,
    mode: playerMode,
    gameMode,
    difficulty,
    language,
    password: roomPwd,
    problemCount,
    maxPlayers: playerMode === "1/1" ? 2 : 8,
  };
}
