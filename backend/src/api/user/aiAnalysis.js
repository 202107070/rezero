import { env } from "#config/envConfig.js";

function parseMaybeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce(function (sum, n) {
    return sum + n;
  }, 0) / nums.length;
}

function formatSeconds(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return r + "초";
  return m + "분 " + r + "초";
}

export function buildAnalyticsSummary(profile, matches) {
  const stats = profile?.titleData?.stats || {};
  const totalGames = Number(stats.totalGames || 0);
  const totalWins = Number(stats.totalWins || 0);
  const winrate = totalGames > 0 ? Math.round((totalWins / totalGames) * 1000) / 10 : 0;
  const langWins = stats.langWins && typeof stats.langWins === "object" ? stats.langWins : {};

  const langCount = {};
  const langSolveTimes = {};
  const diffCount = {};
  let solvedCount = 0;
  let problemAttempts = 0;
  const allSolveTimes = [];
  let ratingDeltaSum = 0;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const lang = String(m.language || "UNKNOWN").toUpperCase();
    langCount[lang] = (langCount[lang] || 0) + 1;
    const diff = String(m.difficulty || "UNKNOWN");
    diffCount[diff] = (diffCount[diff] || 0) + 1;
    ratingDeltaSum += Number(m.ratingDelta || 0);

    const times = parseMaybeArray(m.solveTimes)
      .map(Number)
      .filter(function (n) {
        return Number.isFinite(n) && n > 0;
      });
    times.forEach(function (t) {
      allSolveTimes.push(t);
    });
    if (!langSolveTimes[lang]) langSolveTimes[lang] = [];
    times.forEach(function (t) {
      langSolveTimes[lang].push(t);
    });

    const solved = parseMaybeArray(m.solvedProblems);
    solvedCount += solved.length;
    problemAttempts += Math.max(
      Number(m.problemCount || 0),
      parseMaybeArray(m.problemResults).length,
      solved.length,
    );
  }

  const favoriteLang =
    Object.keys(langCount).sort(function (a, b) {
      return langCount[b] - langCount[a];
    })[0] || null;

  const strongestWinLang =
    Object.keys(langWins).sort(function (a, b) {
      return Number(langWins[b] || 0) - Number(langWins[a] || 0);
    })[0] || favoriteLang;

  const fastestLang =
    Object.keys(langSolveTimes)
      .filter(function (lang) {
        return langSolveTimes[lang].length > 0;
      })
      .sort(function (a, b) {
        return avg(langSolveTimes[a]) - avg(langSolveTimes[b]);
      })[0] || null;

  const slowestLang =
    Object.keys(langSolveTimes)
      .filter(function (lang) {
        return langSolveTimes[lang].length > 0;
      })
      .sort(function (a, b) {
        return avg(langSolveTimes[b]) - avg(langSolveTimes[a]);
      })[0] || null;

  const solveRate =
    problemAttempts > 0 ? Math.round((solvedCount / problemAttempts) * 1000) / 10 : 0;

  return {
    displayName: profile?.displayName || profile?.username || "유저",
    ratingScore: Number(profile?.ratingScore || 1000),
    gold: Number(profile?.gold || 0),
    totalGames,
    totalWins,
    losses: Math.max(0, totalGames - totalWins),
    winrate,
    consecutiveWins: Number(stats.consecutiveWins || 0),
    avgSpeed: Number(stats.avgSpeed || 0),
    perfectGame: Boolean(stats.perfectGame),
    langWins,
    langCount,
    diffCount,
    favoriteLang,
    strongestWinLang,
    fastestLang,
    slowestLang,
    avgSolveTimeSec: Math.round(avg(allSolveTimes)),
    solveRate,
    recentMatchCount: matches.length,
    ratingDeltaSum,
    itemInventory: profile?.itemInventory || {},
  };
}

export function buildLocalAnalysisText(summary) {
  const lines = [];
  lines.push(
    summary.displayName +
      " 님의 최근 플레이 데이터를 바탕으로 분석한 결과입니다.",
  );
  lines.push("");
  lines.push(
    "• 종합 전적: " +
      summary.totalWins +
      "승 " +
      summary.losses +
      "패 (승률 " +
      summary.winrate +
      "%), 레이팅 " +
      summary.ratingScore +
      "점",
  );

  if (summary.recentMatchCount > 0) {
    lines.push(
      "• 최근 " +
        summary.recentMatchCount +
        "경기 기준 문제 해결률 약 " +
        summary.solveRate +
        "%, 평균 풀이 시간 " +
        formatSeconds(summary.avgSolveTimeSec),
    );
    if (summary.ratingDeltaSum !== 0) {
      lines.push(
        "• 최근 레이팅 변동 합계: " +
          (summary.ratingDeltaSum > 0 ? "+" : "") +
          summary.ratingDeltaSum,
      );
    }
  } else {
    lines.push("• 아직 저장된 매치 제출 기록이 적어 세부 패턴 분석은 제한적입니다.");
  }

  if (summary.strongestWinLang) {
    lines.push(
      "• 강점 언어: " +
        summary.strongestWinLang +
        (summary.langWins[summary.strongestWinLang]
          ? " (해당 언어 승리 " + summary.langWins[summary.strongestWinLang] + "회)"
          : ""),
    );
  }
  if (summary.favoriteLang) {
    lines.push("• 가장 많이 플레이한 언어: " + summary.favoriteLang);
  }
  if (summary.fastestLang && summary.slowestLang) {
    if (summary.fastestLang === summary.slowestLang) {
      lines.push(
        "• 풀이 속도: " +
          summary.fastestLang +
          "에서 비교적 안정적인 페이스를 보입니다.",
      );
    } else {
      lines.push(
        "• 풀이 속도: " +
          summary.fastestLang +
          "에서 빠르고, " +
          summary.slowestLang +
          "에서는 시간이 더 걸리는 편입니다.",
      );
    }
  }

  const diffs = Object.keys(summary.diffCount || {});
  if (diffs.length > 0) {
    const topDiff = diffs.sort(function (a, b) {
      return summary.diffCount[b] - summary.diffCount[a];
    })[0];
    lines.push("• 자주 도전한 난이도: " + topDiff);
  }

  if (summary.consecutiveWins >= 3) {
    lines.push("• 연속 승리 흐름이 좋아 자신감 있는 플레이 스타일입니다.");
  } else if (summary.winrate < 40 && summary.totalGames >= 3) {
    lines.push(
      "• 승률이 다소 낮아 보이니, 익숙한 언어·난이도부터 페이스를 맞추는 것을 추천합니다.",
    );
  } else if (summary.winrate >= 60 && summary.totalGames >= 3) {
    lines.push("• 승률이 높아 경쟁 환경에서 강점을 잘 살리고 있습니다.");
  }

  const items = summary.itemInventory || {};
  const hintish =
    Number(items.revealLength || 0) +
    Number(items.revealPrev || 0) +
    Number(items.blankBreak || 0);
  if (hintish > 0) {
    lines.push(
      "• 보유 힌트/보조 아이템이 " +
        hintish +
        "개 있어, 아이템전에서 상황 타개 수단이 충분합니다.",
    );
  }

  lines.push("");
  lines.push(
    "팁: 약한 언어는 연습 모드로 짧게 반복하고, 강점 언어로는 레이팅전에서 승부를 보는 전략이 효과적입니다.",
  );

  return lines.join("\n");
}

export async function generateCursorAnalysis(summary) {
  if (!env.cursorApiKey) return null;

  const { Agent } = await import("@cursor/sdk");
  const prompt =
    "당신은 코딩 배틀 게임 코치입니다. 아래 JSON만 보고 한국어로 친절하게 분석하세요. " +
    "프로그래밍 언어 이름(Java, Python, JavaScript, TypeScript, C, SQL)만 영어를 허용하고 나머지 단어는 모두 한국어로 쓰세요. " +
    "마크다운 기호(**, *, #, `)는 쓰지 마세요. 문장과 '• ' 불릿만 사용하세요. " +
    "과장하지 말고 800자 이내로 작성하세요. 파일을 읽거나 수정하지 말고 분석 문장만 출력하세요.\n\n" +
    JSON.stringify(summary, null, 2);

  const result = await Agent.prompt(prompt, {
    apiKey: env.cursorApiKey,
    model: { id: env.cursorModel || "composer-2.5" },
    mode: "plan",
    tools: [],
    local: { cwd: process.cwd() },
  });

  if (result.status === "error") {
    const message = result.error?.message || "Cursor agent run failed";
    throw new Error("Cursor AI 오류: " + message);
  }

  const content = typeof result.result === "string" ? result.result.trim() : "";
  if (!content) {
    throw new Error("Cursor AI 응답이 비어 있습니다.");
  }
  return polishAnalysisText(content);
}

const ENGLISH_TO_KOREAN = [
  [/\bwin\s*rate\b/gi, "승률"],
  [/\brating\b/gi, "레이팅"],
  [/\bstrengths?\b/gi, "강점"],
  [/\bweakness(?:es)?\b/gi, "약점"],
  [/\bpractice\b/gi, "연습"],
  [/\bmatch(?:es)?\b/gi, "매치"],
  [/\bgame(?:s)?\b/gi, "게임"],
  [/\bproblem(?:s)?\b/gi, "문제"],
  [/\bcode\b/gi, "코드"],
  [/\bspeed\b/gi, "속도"],
  [/\baccuracy\b/gi, "정확도"],
  [/\bdifficulty\b/gi, "난이도"],
  [/\beasy\b/gi, "쉬움"],
  [/\bnormal\b/gi, "보통"],
  [/\bhard\b/gi, "어려움"],
  [/\bunknown\b/gi, "알 수 없음"],
  [/\btip:?\b/gi, "팁:"],
  [/\brecommend(?:ation|ed)?\b/gi, "추천"],
  [/\bsummary\b/gi, "요약"],
  [/\banaly(?:sis|ze)\b/gi, "분석"],
  [/\bcorrect\b/gi, "정답"],
  [/\bwrong\b/gi, "오답"],
  [/\btime\b/gi, "시간"],
  [/\bscore\b/gi, "점수"],
  [/\buser\b/gi, "사용자"],
  [/\broom\b/gi, "방"],
];

export function polishAnalysisText(text) {
  let out = String(text || "");
  out = out.replace(/\*\*|__|~~/g, "");
  out = out.replace(/`+/g, "");
  out = out.replace(/^#{1,6}\s*/gm, "");
  out = out.replace(/^\s*[-*]\s+/gm, "• ");
  for (let i = 0; i < ENGLISH_TO_KOREAN.length; i++) {
    out = out.replace(ENGLISH_TO_KOREAN[i][0], ENGLISH_TO_KOREAN[i][1]);
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildMatchAnalysisText(entry) {
  const problems = Array.isArray(entry?.problems) ? entry.problems : [];
  const codes = Array.isArray(entry?.codes) ? entry.codes : [];
  const lang = entry?.lang || "UNKNOWN";
  const roomLabel = entry?.roomId ? entry.roomId + "번 방" : "개인 매치";
  const lines = [];
  lines.push(roomLabel + "에서 " + lang + "로 진행한 한 판입니다.");
  lines.push("문제 수는 " + (problems.length || codes.length || 0) + "개입니다.");
  if (problems.length > 0) {
    const titles = problems
      .map(function (problem, index) {
        return problem?.title || "문제 " + (index + 1);
      })
      .slice(0, 5);
    lines.push("다룬 문제: " + titles.join(", "));
  }
  const emptyCodes = codes.filter(function (code) {
    return !String(code || "").trim();
  }).length;
  if (codes.length > 0 && emptyCodes === codes.length) {
    lines.push("제출 코드가 비어 있어, 풀이 습관은 확인하기 어렵습니다.");
  } else if (codes.length > 0) {
    lines.push("제출 코드가 남아 있어 이 판의 풀이 흐름을 다시 볼 수 있습니다.");
  }
  lines.push("");
  lines.push("이 방에서 막힌 문제는 같은 언어로 짧게 다시 풀어 보는 것이 좋습니다.");
  return lines.join("\n");
}
