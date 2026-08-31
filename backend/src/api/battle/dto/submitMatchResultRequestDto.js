import { AppError } from "#utils/appError.js";

function invalidRequest(message) {
  return new AppError(400, "INVALID_MATCH_RESULT_REQUEST", message);
}

function numberOrDefault(value, defaultValue = 0) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw invalidRequest("경기 결과의 숫자 값이 올바르지 않습니다.");
  }
  return number;
}

function arrayOrEmpty(value, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalidRequest(fieldName + "은 배열로 입력해 주세요.");
  }
  return value;
}

function objectOrEmpty(value, fieldName) {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw invalidRequest(fieldName + "은 객체로 입력해 주세요.");
  }
  return value;
}

export function parseSubmitMatchResultRequest(params = {}, body = {}) {
  const matchId = typeof params.matchId === "string" ? params.matchId.trim() : "";

  if (!matchId) {
    throw invalidRequest("경기 ID가 필요합니다.");
  }

  return {
    matchId,
    ingameScore: numberOrDefault(body.ingameScore),
    codes: arrayOrEmpty(body.codes, "codes"),
    blankAnswers: arrayOrEmpty(body.blankAnswers, "blankAnswers"),
    selectedOptions: objectOrEmpty(body.selectedOptions, "selectedOptions"),
    solveTimes: objectOrEmpty(body.solveTimes, "solveTimes"),
    problemResults: arrayOrEmpty(body.problemResults, "problemResults"),
    solvedProblems: arrayOrEmpty(body.localSolvedProblems, "localSolvedProblems"),
    totalSolveTime: numberOrDefault(body.totalSolveTime),
    completionTime: numberOrDefault(body.finishedAtElapsedSec),
    finishedAtElapsed: numberOrDefault(body.finishedAtElapsedSec),
  };
}
