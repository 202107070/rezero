import dotenv from "dotenv";

dotenv.config();

export const PREPARE_INFO_CONFIG = {
  defaultGameDurationSeconds: 180,
  defaultProblemCount: 3,
  defaultMaxPlayers: 2,

  defaults: {
    gameMode: "normal",
    difficulty: "EASY",
    language: "PYTHON",
  },

  valkey: {
    lockTTLSeconds: 10,
    keys: {
      lockInit: function (roomId) {
        return "lock:battle:init:" + roomId;
      },
      matchState: function (matchId) {
        return "match:" + matchId + ":state";
      },
    },
  },

  fallbackProblem: {
    id: "prob_101",
    type: "CHOICE",
    difficulty: "easy",
    title: "두 수의 합 구하기",
    question: "1 + 1의 결과는?",
    options: JSON.stringify(["1", "2", "3", "4"]),
    description: "기초 산수 문제",
  },
};
