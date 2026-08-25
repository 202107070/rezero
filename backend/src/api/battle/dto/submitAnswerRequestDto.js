import { AppError } from "#utils/appError.js";

function invalidRequest(message) {
  return new AppError(400, "INVALID_ANSWER_REQUEST", message);
}

export function parseSubmitAnswerRequest(params = {}, body = {}) {
  const matchId = typeof params.matchId === "string" ? params.matchId.trim() : "";
  const problemIndex = Number(body.problemIndex);
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const selectedOption = body.selectedOption;

  if (!matchId) {
    throw invalidRequest("경기 ID가 필요합니다.");
  }

  if (!Number.isInteger(problemIndex) || problemIndex < 0) {
    throw invalidRequest("문제 번호가 올바르지 않습니다.");
  }

  if (
    !answers.every(function (answer) {
      return typeof answer === "string";
    })
  ) {
    throw invalidRequest("답안은 문자열 배열로 입력해 주세요.");
  }

  if (selectedOption !== undefined && !Number.isInteger(Number(selectedOption))) {
    throw invalidRequest("객관식 답안이 올바르지 않습니다.");
  }

  return {
    matchId,
    problemIndex,
    answers,
    selectedOption:
      selectedOption === undefined ? undefined : Number(selectedOption),
  };
}
