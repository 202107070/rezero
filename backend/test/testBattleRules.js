import { judgeProblemAnswer } from "../src/api/problem/service.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runTest() {
  console.log("--- 배틀 규칙 단위 테스트 시작 ---");

  assert(
    judgeProblemAnswer({
      problem: { type: "fill_blank", answer: { JAVA: ["int", "for"] } },
      language: "JAVA",
      answers: [" int ", "FOR"],
    }),
    "빈칸 문제 정답 판정에 실패했습니다.",
  );
  console.log("PASS: 빈칸 문제 정답 판정");

  assert(
    !judgeProblemAnswer({
      problem: { type: "short_answer", answer: { JAVA: ["3"] } },
      language: "JAVA",
      answers: ["4"],
    }),
    "주관식 오답 판정에 실패했습니다.",
  );
  console.log("PASS: 주관식 오답 판정");

  assert(
    judgeProblemAnswer({
      problem: { type: "multiple_choice", correctIndex: 2, answer: {} },
      language: "JAVA",
      selectedOption: 2,
    }),
    "객관식 정답 판정에 실패했습니다.",
  );
  console.log("PASS: 객관식 정답 판정");

  console.log("--- 배틀 규칙 단위 테스트 완료 ---");
}

runTest();
