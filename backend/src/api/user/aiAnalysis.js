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

function looseAnswer(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isFilledText(value) {
  const text = String(value || "").trim();
  return text.length > 0 && text !== "(미입력)";
}

export function buildRoomChart(entry) {
  const lang = String(entry?.lang || "UNKNOWN").toUpperCase();
  const problems = Array.isArray(entry?.problems) ? entry.problems : [];
  const total = problems.length;
  let correct = 0;
  let attempted = 0;
  let blankTotal = 0;
  let blankCorrect = 0;
  let choiceTotal = 0;
  let choiceCorrect = 0;
  let shortTotal = 0;
  let shortCorrect = 0;
  let langSpecific = 0;
  let langSpecificOk = 0;

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i] || {};
    const type = String(problem.type || "");
    const blanks = Array.isArray(problem.userBlanks) ? problem.userBlanks : [];
    const answerMap = problem.answer && typeof problem.answer === "object" ? problem.answer : {};
    const expected = Array.isArray(answerMap[lang])
      ? answerMap[lang]
      : Array.isArray(answerMap.JAVA)
        ? answerMap.JAVA
        : [];
    const wrote =
      blanks.some(function (blank) {
        return isFilledText(blank);
      }) ||
      (problem.selectedOption != null && Number(problem.selectedOption) >= 0) ||
      isFilledText(problem.userAnswer);
    if (wrote) attempted += 1;

    const blankCount = (String(problem.question || "").match(/_____/g) || []).length;
    let ok = false;
    if (type === "multiple_choice" || (Array.isArray(problem.options) && problem.options.length > 0 && blankCount === 0)) {
      choiceTotal += 1;
      ok = Number(problem.selectedOption) === Number(problem.correctIndex);
      if (ok) choiceCorrect += 1;
    } else if (blankCount > 0 || blanks.length > 1) {
      blankTotal += 1;
      ok =
        expected.length > 0 &&
        expected.every(function (answer, index) {
          return looseAnswer(blanks[index]) !== "" && looseAnswer(blanks[index]) === looseAnswer(answer);
        });
      if (ok) blankCorrect += 1;
    } else {
      shortTotal += 1;
      const user = isFilledText(blanks[0]) ? blanks[0] : problem.userAnswer;
      ok = expected.length > 0 && looseAnswer(user) !== "" && looseAnswer(user) === looseAnswer(expected[0]);
      if (ok) shortCorrect += 1;
    }
    if (ok) correct += 1;

    const langAnswers = JSON.stringify(answerMap[lang] || []);
    const differs = Object.keys(answerMap).some(function (key) {
      return key !== lang && JSON.stringify(answerMap[key] || []) !== langAnswers;
    });
    if (differs && Array.isArray(answerMap[lang]) && answerMap[lang].length > 0) {
      langSpecific += 1;
      if (ok) langSpecificOk += 1;
    }
  }

  const percent = function (num, den) {
    if (!den) return 0;
    return Math.max(0, Math.min(100, Math.round((num / den) * 1000) / 10));
  };
  const roomLabel = entry?.roomId ? String(entry.roomId) + "번 방" : "이 방";
  const solveRate = percent(correct, total);
  const attemptRate = percent(attempted, total);
  const choiceRate = percent(choiceCorrect, choiceTotal);
  const shortRate = percent(shortCorrect, shortTotal);
  const missed = Math.max(0, total - correct);
  const langNames = { JAVA: "Java", PYTHON: "Python", CPP: "C++", HTML: "HTML", CSS: "CSS" };
  const langName = langNames[lang] || lang;
  const solveTimeList = parseMaybeArray(entry?.solveTimes)
    .map(Number)
    .filter(function (n) {
      return Number.isFinite(n) && n > 0;
    });
  const avgSec = solveTimeList.length ? avg(solveTimeList) : 0;
  const speedScore = solveTimeList.length
    ? Math.max(0, Math.min(100, Math.round((1 - Math.min(avgSec, 180) / 180) * 1000) / 10))
    : 0;
  const times = solveTimeList;
  const langScore = langSpecific ? percent(langSpecificOk, langSpecific) : solveRate;

  return {
    roomId: entry?.roomId ? String(entry.roomId) : "",
    lang,
    problemCount: total,
    winrate: solveRate,
    solveRate,
    ratingScore: 0,
    avgSolveTimeSec: 0,
    totalWins: correct,
    losses: missed,
    recentMatchCount: 1,
    axes: [
      {
        label: "정답",
        value: solveRate,
        detail: roomLabel + " · " + lang,
        why:
          total +
          "문제 중 " +
          correct +
          "문제를 맞혀 이 판의 정답률은 " +
          solveRate +
          "%입니다.\n다른 방 전적은 넣지 않고, 이 방에 남긴 답만 정답과 비교했습니다.",
      },
      {
        label: "속도",
        value: speedScore,
        detail: times.length ? "평균 " + formatSeconds(avgSec) : "시간 기록 없음",
        why: times.length
          ? "맞힌 문제의 평균 풀이 시간은 " +
            formatSeconds(avgSec) +
            "입니다.\n3분 안에 가까울수록 속도 점수가 높고, 이 방의 기록만 반영합니다."
          : "이 방에는 문제별 풀이 시간이 남아 있지 않습니다.\n다음 판부터 맞힌 문제의 시간이 속도 축에 쌓입니다.",
      },
      {
        label: "언어",
        value: langScore,
        detail: langName + (langSpecific ? " · " + langSpecificOk + "/" + langSpecific : ""),
        why: langSpecific
          ? langName +
            "에서만 표기가 다른 문제 " +
            langSpecific +
            "개 중 " +
            langSpecificOk +
            "개를 맞혔습니다.\nJava의 println과 Python의 print처럼, 이 방 언어의 정답만 비교했습니다."
          : "이 방 언어는 " +
            langName +
            "이고, 문제는 언어마다 정답이 같지 않은 문항이 없었습니다.\n정답률과 같은 값으로, 어떤 언어 판이었는지만 따로 보여 줍니다.",
      },
      {
        label: "객관식",
        value: choiceTotal ? choiceRate : attemptRate,
        detail: choiceTotal ? choiceCorrect + "/" + choiceTotal + "문항" : "객관식 없음",
        why: choiceTotal
          ? "객관식 " +
            choiceTotal +
            "문항 중 " +
            choiceCorrect +
            "개를 골랐습니다.\n보기를 고른 번호가 정답 번호와 같은지만 이 축에 반영됩니다."
          : "이 방에는 객관식이 없어 시도율로 대신 표시했습니다.\n선택지가 있는 판의 그래프와 기준을 맞추기 위해서입니다.",
      },
      {
        label: "단답",
        value: shortTotal ? shortRate : solveRate,
        detail: shortTotal ? shortCorrect + "/" + shortTotal + "문항" : lang,
        why: shortTotal
          ? "단답 " +
            shortTotal +
            "문항 중 " +
            shortCorrect +
            "개가 맞았습니다.\n" +
            lang +
            " 표기에서 띄어쓰기만 다른 답은 정답으로 인정합니다."
          : "단답형 문항이 없어 이 방 정답률을 그대로 씁니다.\n언어는 " + lang + " 한 판만 반영했습니다.",
      },
      {
        label: "완성",
        value: percent(correct, Math.max(attempted, 1)),
        detail: "맞힌 " + correct + " · 틀린 " + Math.max(0, attempted - correct),
        why:
          "답을 쓴 " +
          attempted +
          "문제 가운데 " +
          correct +
          "개가 맞았습니다.\n비운 문제는 빼서, 손댄 문제만 얼마나 맞았는지 보여 줍니다.",
      },
    ],
  };
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
