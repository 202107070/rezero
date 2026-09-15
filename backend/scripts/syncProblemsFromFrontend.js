/**
 * frontend/src/data/problems.js 문제 은행을 DB problems 테이블에 동기화합니다.
 * (구 dummyData의 언어 키 없는 문제 → CSS/HTML 선택 시 다른 과목 문제가 섞이던 원인 해결)
 *
 * 사용 (Pi에서 권장):
 *   node backend/scripts/syncProblemsFromFrontend.js
 *
 * Windows에서 Pi DB에 붙을 때:
 *   set DB_HOST=100.126.240.26
 *   node backend/scripts/syncProblemsFromFrontend.js
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import mariadb from "mariadb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const problemsPath = path.resolve(
  __dirname,
  "../../frontend/src/data/problems.js",
);

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 2,
  connectTimeout: 8000,
});

function toJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

async function main() {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("backend/.env 에 DB_USER / DB_NAME 이 필요합니다.");
  }

  const mod = await import(pathToFileURL(problemsPath).href);
  const problems = mod.default || mod.problems;
  if (!Array.isArray(problems) || problems.length === 0) {
    throw new Error("problems.js 를 불러오지 못했습니다.");
  }

  // 동일 id가 여러 번 정의된 경우 마지막 정의 사용
  const byId = new Map();
  for (const problem of problems) {
    if (!problem?.id) continue;
    byId.set(String(problem.id), problem);
  }
  const unique = [...byId.values()];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 구형(언어 키 없는) 더미 문제 제거 후 프론트 문제 은행으로 교체
    await conn.query("DELETE FROM problems");

    for (const problem of unique) {
      await conn.query(
        `INSERT INTO problems (
           id, type, difficulty, title, question, answer, options,
           correct_index, explanation, description, input, output, visual, capability_overrides
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           type = VALUES(type),
           difficulty = VALUES(difficulty),
           title = VALUES(title),
           question = VALUES(question),
           answer = VALUES(answer),
           options = VALUES(options),
           correct_index = VALUES(correct_index),
           explanation = VALUES(explanation),
           visual = VALUES(visual),
           capability_overrides = VALUES(capability_overrides)`,
        [
          String(problem.id).slice(0, 16),
          String(problem.type || "fill_blank"),
          String(problem.difficulty || "easy"),
          String(problem.title || "").slice(0, 200),
          String(problem.question || ""),
          toJson(problem.answer || {}),
          toJson(problem.options ?? null),
          problem.correctIndex == null ? null : Number(problem.correctIndex),
          String(problem.explanation || ""),
          problem.description == null ? null : String(problem.description),
          problem.input == null ? null : String(problem.input),
          problem.output == null ? null : String(problem.output),
          toJson(problem.visual ?? null),
          toJson(problem.capabilityOverrides ?? null),
        ],
      );
    }

    await conn.commit();
    console.log(
      `[syncProblems] ${unique.length}개 문제 동기화 완료 (원본 ${problems.length}개, 중복 id 제거)`,
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[syncProblems] 실패:", error.message || error);
  process.exit(1);
});
