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

export async function generateOpenAiAnalysis(summary) {
  if (!env.openAiApiKey) return null;

  const prompt =
    "당신은 코딩 배틀 게임 코치입니다. 아래 JSON 통계를 보고 한국어로 친절하고 구체적인 사용자 분석을 작성하세요. " +
    "강점/약점/언어별 특징/풀이 속도/추천 연습 방향을 포함하세요. 과장하지 말고 800자 이내로 작성하세요.\n\n" +
    JSON.stringify(summary, null, 2);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.openAiApiKey,
    },
    body: JSON.stringify({
      model: env.openAiModel || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a helpful Korean coding battle coach.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("OpenAI API 오류: " + response.status + " " + text.slice(0, 200));
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }
  return content.trim();
}
