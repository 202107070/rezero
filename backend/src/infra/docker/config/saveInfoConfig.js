import dotenv from "dotenv";

dotenv.config();

export const SAVE_CONFIG = {
  tables: {
    matchResults: "match_results",
    userStats: "user_stats",
    submissionLogs: "submission_logs",
  },

  scoring: {
    winBaseScore: 100,
    timeBonusMultiplier: 0.5,
    participationScore: 10,
  },

  valkey: {
    keys: {
      matchResult: function (matchId) {
        return "match:" + matchId + ":result";
      },
    },
  },
};
