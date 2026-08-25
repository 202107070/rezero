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
  const candidates = problemPool
    .map(normalizeProblem)
    .filter(function (problem) {
      if (normalizedLanguage === "RANDOM") {
        return true;
      }

      return Object.prototype.hasOwnProperty.call(
        problem.answer,
        normalizedLanguage,
      );
    });

  if (candidates.length === 0) {
    throw new AppError(
      404,
      "PROBLEMS_NOT_FOUND",
      "선택한 조건에 맞는 문제가 없습니다.",
    );
  }

  const selectedProblems = [];

  // 문제 후보를 모두 사용한 경우에만 다시 섞어서 재사용합니다.
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

  const problemPool = await problemModel.findProblemsByDifficulty(difficulty);
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
