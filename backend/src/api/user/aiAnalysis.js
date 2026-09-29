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

function sectionText(title, bullets) {
  const items = (bullets || []).filter(function (line) {
    return String(line || "").trim();
  });
  const lines = [title];
  if (items.length === 0) {
    lines.push("• 아직 판단할 기록이 부족합니다.");
  } else {
    items.forEach(function (line) {
      lines.push("• " + line);
    });
  }
  return lines.join("\n");
}

export function buildLocalAnalysisText(summary) {
  const skill = [
    summary.totalWins +
      "승 " +
      summary.losses +
      "패, 승률 " +
      summary.winrate +
      "%, 레이팅 " +
      summary.ratingScore +
      "점",
  ];
  if (summary.recentMatchCount > 0) {
    skill.push(
      "최근 " +
        summary.recentMatchCount +
        "경기 해결률 약 " +
        summary.solveRate +
        "%, 평균 풀이 시간 " +
        formatSeconds(summary.avgSolveTimeSec),
    );
  } else {
    skill.push("저장된 매치 기록이 아직 적어 세부 실력 판단은 제한적입니다.");
  }

  const strengths = [];
  if (summary.strongestWinLang) {
    strengths.push(summary.strongestWinLang + "에서 승리가 많습니다.");
  }
  if (summary.favoriteLang) {
    strengths.push("가장 많이 플레이한 언어는 " + summary.favoriteLang + "입니다.");
  }
  if (summary.fastestLang) {
    strengths.push(summary.fastestLang + "에서 풀이 속도가 비교적 빠릅니다.");
  }
  if (summary.winrate >= 60 && summary.totalGames >= 3) {
    strengths.push("승률이 높아 경쟁 환경에서 강점을 잘 살리고 있습니다.");
  }

  const weaknesses = [];
  if (summary.slowestLang && summary.slowestLang !== summary.fastestLang) {
    weaknesses.push(summary.slowestLang + "에서는 풀이 시간이 더 걸립니다.");
  }
  if (summary.winrate < 40 && summary.totalGames >= 3) {
    weaknesses.push("승률이 낮아 익숙한 언어와 난이도에서 페이스를 맞출 필요가 있습니다.");
  }
  if (summary.solveRate < 50 && summary.recentMatchCount > 0) {
    weaknesses.push("최근 경기에서 문제를 끝까지 해결하지 못한 경우가 있습니다.");
  }

  const practice = [];
  if (summary.slowestLang) {
    practice.push(summary.slowestLang + "를 연습 모드에서 짧게 반복하세요.");
  }
  practice.push("막힌 문제는 비우지 말고 부분 답이라도 남기는 연습을 하세요.");
  if (summary.strongestWinLang) {
    practice.push(summary.strongestWinLang + "로는 레이팅전에서 승부를 보는 편이 좋습니다.");
  }

  return [
    sectionText("실력", skill),
    "",
    sectionText("장점", strengths),
    "",
    sectionText("부족한 점", weaknesses),
    "",
    sectionText("연습 포인트", practice),
  ].join("\n");
}

export async function generateCursorAnalysis(summary) {
  if (!env.cursorApiKey) return null;

  const { Agent } = await import("@cursor/sdk");
  const prompt =
    "당신은 코딩 배틀 게임 코치입니다. 아래 JSON만 보고 플레이어 본인을 한국어로 분석하세요. " +
    "방 소개, 문제 나열, 게임 규칙 설명은 하지 마세요. " +
    "모든 사용자에게 같은 형식으로 출력하세요. 제목은 아래 네 줄을 정확히 이 순서와 철자로만 쓰고, 다른 제목은 만들지 마세요.\n" +
    "실력\n" +
    "장점\n" +
    "부족한 점\n" +
    "연습 포인트\n" +
    "각 제목 다음에는 '• '로 시작하는 불릿을 2개 이상 4개 이하로 쓰세요. " +
    "프로그래밍 언어 이름(Java, Python, JavaScript, TypeScript, C, SQL)만 영어를 허용하고 나머지 단어는 모두 한국어로 쓰세요. " +
    "마크다운 기호(**, *, #, `)는 쓰지 마세요. " +
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

export function buildMatchAnalysisText(entry, profileSummary) {
  const codes = Array.isArray(entry?.codes) ? entry.codes : [];
  const lang = entry?.lang || "UNKNOWN";
  const filled = codes.filter(function (code) {
    return String(code || "").trim().length > 0 && String(code).trim() !== "(미입력)";
  }).length;
  const total = Math.max(codes.length, Array.isArray(entry?.problems) ? entry.problems.length : 0, 1);
  const skill = [
    "이 판 사용 언어는 " + lang + "입니다.",
    profileSummary
      ? "현재 레이팅 " +
        (profileSummary.ratingScore || 1000) +
        ", 승률 " +
        (profileSummary.winrate || 0) +
        "% (" +
        (profileSummary.totalWins || 0) +
        "승 " +
        (profileSummary.losses || 0) +
        "패)"
      : "누적 전적 정보가 아직 없습니다.",
    total + "문제 중 " + filled + "문제에 답안이 있습니다.",
  ];
  const strengths = [];
  if (profileSummary?.strongestWinLang) {
    strengths.push(profileSummary.strongestWinLang + "에서 승리가 많습니다.");
  }
  if (filled >= total) {
    strengths.push("모든 문제에 답안을 남겨 끝까지 완성하는 점이 좋습니다.");
  }
  const weaknesses = [];
  if (filled === 0) {
    weaknesses.push("제출 답안이 거의 비어 있어 문제 접근이 중간에 끊겼습니다.");
  } else if (filled < total) {
    weaknesses.push(total + "문제 중 " + (total - filled) + "문제는 답안이 비어 있습니다.");
  }
  if (profileSummary?.slowestLang && profileSummary.slowestLang !== profileSummary.fastestLang) {
    weaknesses.push(profileSummary.slowestLang + " 풀이 속도가 상대적으로 느립니다.");
  }
  const practice = [
    "막힌 문제는 비우지 말고 부분 답이라도 남기세요.",
    (profileSummary?.slowestLang || lang) + "를 연습 모드에서 짧게 반복하세요.",
  ];
  return [
    sectionText("실력", skill),
    "",
    sectionText("장점", strengths),
    "",
    sectionText("부족한 점", weaknesses),
    "",
    sectionText("연습 포인트", practice),
  ].join("\n");
}
