import { applyLanguageVariant } from "./variants.js";
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

function isWhitespaceLiteralAnswer(expected) {
  const s = String(expected ?? "").replace(/\u00a0/g, " ");
  return s.length > 0 && s.trim() === "";
}

function normalizeAnswer(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function answersEqual(user, expected) {
  if (isWhitespaceLiteralAnswer(expected)) {
    return (
      String(user ?? "").replace(/\u00a0/g, " ") ===
      String(expected ?? "").replace(/\u00a0/g, " ")
    );
  }
  const left = normalizeAnswer(user);
  const right = normalizeAnswer(expected);
  return left.length > 0 && left === right;
}

function getAnswersForLanguage(answer, language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (Array.isArray(answer[normalizedLanguage])) {
    return answer[normalizedLanguage];
  }

  // C++ ↔ CPP
  if (normalizedLanguage === "CPP" && Array.isArray(answer["C++"])) {
    return answer["C++"];
  }
  if (normalizedLanguage === "C++" && Array.isArray(answer.CPP)) {
    return answer.CPP;
  }

  // 언어가 지정된 경우 다른 언어 정답으로 폴백하지 않음
  if (normalizedLanguage && normalizedLanguage !== "RANDOM") {
    return [];
  }

  for (const values of Object.values(answer)) {
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
  }

  return [];
}

/** 아이템/힌트용: 지정 언어 정답이 없으면 다른 언어 정답으로 폴백 */
export function resolveProblemAnswers(problem, language) {
  const answer = parseJson(problem?.answer, {});
  const preferred = getAnswersForLanguage(answer, language);
  if (preferred.length > 0) {
    return preferred.map(function (value) {
      return String(value ?? "");
    });
  }

  for (const values of Object.values(answer || {})) {
    if (Array.isArray(values) && values.length > 0) {
      return values.map(function (value) {
        return String(value ?? "");
      });
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

function answerHasLanguage(answer, normalizedLanguage) {
  if (!answer || typeof answer !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(answer, normalizedLanguage)) {
    return Array.isArray(answer[normalizedLanguage]);
  }
  if (normalizedLanguage === "CPP" && Object.prototype.hasOwnProperty.call(answer, "C++")) {
    return Array.isArray(answer["C++"]);
  }
  if (normalizedLanguage === "C++" && Object.prototype.hasOwnProperty.call(answer, "CPP")) {
    return Array.isArray(answer.CPP);
  }
  return false;
}

export function chooseProblems(problemPool, language, count, random = Math.random) {
  const requested = normalizeLanguage(language);
  const normalized = problemPool.map(normalizeProblem);
  function candidatesFor(key) {
    return normalized.filter(p => answerHasLanguage(p.answer, key))
      .map(p => applyLanguageVariant(p, key)).filter(Boolean);
  }
  const languages = requested === "RANDOM"
    ? ["JAVA", "PYTHON", "CPP", "HTML", "CSS"].filter(key => candidatesFor(key).length >= count)
    : [requested];
  const key = languages[Math.floor(random() * languages.length)];
  const candidates = candidatesFor(key);
  if (candidates.length < count) {
    throw new AppError(409, "INSUFFICIENT_PROBLEMS", "선택한 언어와 난이도의 검증된 문제가 부족합니다. 문제 수를 줄여 주세요.");
  }
  return shuffleProblems(candidates, random).slice(0, count);
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
    return answersEqual(answers[0], expectedAnswers[0]);
  }

  if (answers.length !== expectedAnswers.length) {
    return false;
  }

  return answers.every(function (answer, index) {
    return answersEqual(answer, expectedAnswers[index]);
  });
}
