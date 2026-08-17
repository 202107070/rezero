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
