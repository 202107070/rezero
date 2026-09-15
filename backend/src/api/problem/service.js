import * as problemModel from "./model.js";
import { AppError } from "#utils/appError.js";

const DIFFICULTY_MAP = {
  "쉬움": "easy",
  EASY: "easy",
  "보통": "medium",
  NORMAL: "medium",
  MEDIUM: "medium",
  "어려움": "hard",
  HARD: "hard",
};

const LANGUAGE_MAP = {
  "C++": "CPP",
  RANDOM: "RANDOM",
};

function normalizeDifficulty(difficulty) {
  const value = String(difficulty || "").trim().toUpperCase();
  return DIFFICULTY_MAP[value] || null;
}

function normalizeLanguage(language) {
  const value = String(language || "").trim().toUpperCase();
  return LANGUAGE_MAP[value] || value;
}

function parseJson(value, fallbackValue) {
  if (value === null || value === undefined) {
    return fallbackValue;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
}

function normalizeAnswer(value) {
  return String(value || "").trim().toLowerCase();
}

function getAnswersForLanguage(answer, language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (Array.isArray(answer[normalizedLanguage])) {
    return answer[normalizedLanguage];
  }

  for (const values of Object.values(answer)) {
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  return [];
}

function normalizeProblem(problem) {
  return {
    ...problem,
    answer: parseJson(problem.answer, {}),
    options: parseJson(problem.options, null),
    visual: parseJson(problem.visual, null),
    capabilityOverrides: parseJson(problem.capabilityOverrides, null),
  };
}

function shuffleProblems(problems, random) {
  const shuffled = [...problems];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = current;
  }

  return shuffled;
}

export function chooseProblems(problemPool, language, count, random = Math.random) {
  const normalizedLanguage = normalizeLanguage(language);
  const normalizedProblems = problemPool.map(normalizeProblem);

  function matchesLanguage(problem) {
    if (normalizedLanguage === "RANDOM") {
      return true;
    }
    // 객관식은 언어 키가 없을 수 있음
    if (problem.type === "multiple_choice") {
      return true;
    }
    const answer = problem.answer || {};
    if (Object.prototype.hasOwnProperty.call(answer, normalizedLanguage)) {
      return true;
    }
    // C++ ↔ CPP 등
    if (normalizedLanguage === "CPP" && Object.prototype.hasOwnProperty.call(answer, "C++")) {
      return true;
    }
    if (normalizedLanguage === "C++" && Object.prototype.hasOwnProperty.call(answer, "CPP")) {
      return true;
    }
    return false;
  }

  let candidates = normalizedProblems.filter(matchesLanguage);

  // 언어 필터로 비면 같은 난이도(풀) 전체로 완화
  if (candidates.length === 0) {
    candidates = normalizedProblems.filter(function (problem) {
      const answer = problem.answer || {};
      return (
        problem.type === "multiple_choice" ||
        Object.keys(answer).length > 0 ||
        Boolean(problem.question)
      );
    });
  }

  if (candidates.length === 0) {
    throw new AppError(
      404,
      "PROBLEMS_NOT_FOUND",
      "선택한 조건에 맞는 문제가 없습니다.",
    );
  }

  const selectedProblems = [];

  while (selectedProblems.length < count) {
    const shuffled = shuffleProblems(candidates, random);
    const remainingCount = count - selectedProblems.length;
    selectedProblems.push(...shuffled.slice(0, remainingCount));
  }

  return selectedProblems;
}

export async function selectProblems(input) {
  const difficulty = normalizeDifficulty(input.difficulty);
  const count = Number(input.count);

  if (!difficulty) {
    throw new AppError(
      400,
      "INVALID_PROBLEM_DIFFICULTY",
      "지원하지 않는 문제 난이도입니다.",
    );
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new AppError(
      400,
      "INVALID_PROBLEM_COUNT",
      "문제 수는 1개 이상이어야 합니다.",
    );
  }

  let problemPool = await problemModel.findProblemsByDifficulty(difficulty);
  if (!problemPool.length) {
    // DB 난이도 표기가 다른 경우를 대비해 전체 풀로 폴백
    problemPool = await problemModel.findAllProblems();
  }

  return chooseProblems(problemPool, input.language, count);
}

// 문제 정답은 서버 안에서만 비교하고 응답에는 정답 여부만 반환합니다.
export function judgeProblemAnswer(input) {
  const problem = input.problem;
  const answers = Array.isArray(input.answers) ? input.answers : [];
  const selectedOption = input.selectedOption;

  if (!problem || !problem.type) {
    throw new AppError(400, "INVALID_PROBLEM", "문제 정보가 올바르지 않습니다.");
  }

  if (problem.type === "multiple_choice") {
    return Number(selectedOption) === Number(problem.correctIndex);
  }

  const expectedAnswers = getAnswersForLanguage(
    parseJson(problem.answer, {}),
    input.language,
  );

  if (expectedAnswers.length === 0) {
    return false;
  }

  if (problem.type === "short_answer") {
    return normalizeAnswer(answers[0]) === normalizeAnswer(expectedAnswers[0]);
  }

  if (answers.length !== expectedAnswers.length) {
    return false;
  }

  return answers.every(function (answer, index) {
    return normalizeAnswer(answer) === normalizeAnswer(expectedAnswers[index]);
  });
}
