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
  const accuracy = [
    summary.totalWins +
      "승 " +
      summary.losses +
      "패, 최근 정답률 약 " +
      summary.solveRate +
      "%입니다.",
  ];
  if (summary.recentMatchCount > 0) {
    accuracy.push(
      "최근 " +
        summary.recentMatchCount +
        "경기의 답을 기준으로 오답 패턴을 살펴봤습니다.",
    );
  }

  const knowledge = [];
  if (summary.strongestWinLang) {
    knowledge.push(summary.strongestWinLang + " 분야 기록이 비교적 안정적입니다.");
  }
  if (summary.favoriteLang && summary.favoriteLang !== summary.strongestWinLang) {
    knowledge.push("가장 많이 플레이한 분야는 " + summary.favoriteLang + "입니다.");
  }
  if (summary.slowestLang && summary.slowestLang !== summary.fastestLang) {
    knowledge.push(summary.slowestLang + " 관련 문제는 추가 학습이 필요합니다.");
  }

  const consistency = [];
  if (summary.avgSolveTimeSec > 0) {
    consistency.push(
      "평균 풀이 시간은 " + formatSeconds(summary.avgSolveTimeSec) + "입니다. 문항 난이도 변화도 함께 볼 필요가 있습니다.",
    );
  } else {
    consistency.push("응답 시간 기록이 부족해 초반·후반만으로 집중력 저하라고 단정하지 않았습니다.");
  }

  const growth = [];
  if (summary.slowestLang) {
    growth.push(
      "다음 경기에서는 " +
        summary.slowestLang +
        " 문제의 정답률을 높이는 데 집중하고, 제출 전 답을 한 번 더 확인해 보세요.",
    );
  } else {
    growth.push("이전 경기 기록이 적으면 현재 경기 기준으로 취약 유형만 복습하는 편이 좋습니다.");
  }
  growth.push("막힌 문제는 비우지 말고 부분 답이라도 남겨 다음 비교 자료를 남기세요.");

  return [
    sectionText("정확도", accuracy),
    "",
    sectionText("지식 숙련도", knowledge),
    "",
    sectionText("일관성", consistency),
    "",
    sectionText("성장 가능성", growth),
  ].join("\n");
}

export async function generateCursorAnalysis(summary) {
  if (!env.cursorApiKey) return null;

  const { Agent } = await import("@cursor/sdk");
  const prompt =
    "당신은 코딩 배틀 게임 코치입니다. 아래 JSON만 보고 플레이어 본인을 한국어로 분석하세요. " +
    "방 소개, 문제 나열, 게임 규칙 설명은 하지 마세요. " +
    "모든 사용자에게 같은 형식으로 출력하세요. 제목은 아래 네 줄을 정확히 이 순서와 철자로만 쓰고, 다른 제목은 만들지 마세요.\n" +
    "정확도\n" +
    "지식 숙련도\n" +
    "일관성\n" +
    "성장 가능성\n" +
    "정확도: 정답률, 오답 수, 문제 유형별 정답률을 보고 특정 유형에 오답이 몰렸으면 그 패턴을 짚으세요. " +
    "지식 숙련도: CSS, HTML, JavaScript 등 출제 분야별 정답률을 보고, 객관식과 단답형은 별도 실력 축으로 단정하지 말고 분야 안의 보조 정보로만 쓰세요. " +
    "일관성: 초반·후반 정답률, 연속 오답, 응답 시간 변동을 보되 문항 순서와 난이도가 달라질 수 있으니 초반·후반 비교만으로 집중력 저하라고 단정하지 마세요. " +
    "성장 가능성: 취약 분야에 대한 구체적 복습 방향과 다음 경기 목표를 제안하세요. 이전 경기 기록이 있을 때만 향상·하락을 말하고, 없으면 현재 경기 기준으로만 제안하세요. " +
    "각 제목 다음에는 '• '로 시작하는 불릿을 2개 이상 4개 이하로 쓰세요. " +
    "프로그래밍 언어 이름(Java, Python, JavaScript, TypeScript, C, HTML, CSS, SQL)만 영어를 허용하고 나머지 단어는 모두 한국어로 쓰세요. " +
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

function percent(num, den) {
  if (!den) return 0;
  return Math.max(0, Math.min(100, Math.round((num / den) * 1000) / 10));
}

function stddev(nums) {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  const square = nums.reduce(function (sum, n) {
    return sum + (n - mean) * (n - mean);
  }, 0);
  return Math.sqrt(square / nums.length);
}

function classifyField(problem, roomLang) {
  const lang = String(roomLang || "").toUpperCase();
  const blob = String((problem?.title || "") + " " + (problem?.question || "")).toLowerCase();
  if (lang === "CSS" || /\bcss\b|flexbox|grid-template|selector|선택자|레이아웃/.test(blob)) {
    return "CSS";
  }
  if (lang === "HTML" || /<\/?[a-z][\s>]|태그|\bhtml\b/.test(blob)) {
    return "HTML";
  }
  if (/\bjavascript\b|\becmascript\b|console\.log/.test(blob)) {
    return "JavaScript";
  }
  if (lang === "PYTHON") return "Python";
  if (lang === "CPP" || lang === "C++") return "C++";
  if (lang === "JAVA") return "Java";
  return lang || "기타";
}

function typeLabel(type, blankCount) {
  if (type === "multiple_choice") return "객관식";
  if (blankCount > 0 || type === "fill_blank" || type === "visual_fill_blank") return "빈칸";
  return "단답";
}

function scoreEntryProblems(entry) {
  const lang = String(entry?.lang || "UNKNOWN").toUpperCase();
  const problems = Array.isArray(entry?.problems) ? entry.problems : [];
  const times = parseMaybeArray(entry?.solveTimes).map(Number);
  const scored = [];

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i] || {};
    const type = String(problem.type || "");
    const blanks = Array.isArray(problem.userBlanks) ? problem.userBlanks : [];
    const answerMap = problem.answer && typeof problem.answer === "object" ? problem.answer : {};
    const expected = Array.isArray(answerMap[lang])
      ? answerMap[lang]
      : Array.isArray(answerMap.HTML)
        ? answerMap.HTML
        : Array.isArray(answerMap.CSS)
          ? answerMap.CSS
          : Array.isArray(answerMap.JAVA)
            ? answerMap.JAVA
            : [];
    const wrote =
      blanks.some(function (blank) {
        return isFilledText(blank);
      }) ||
      (problem.selectedOption != null && Number(problem.selectedOption) >= 0) ||
      isFilledText(problem.userAnswer);
    const blankCount = (String(problem.question || "").match(/_____/g) || []).length;
    const kind = typeLabel(type, blankCount);
    let ok = false;
    if (kind === "객관식") {
      ok = Number(problem.selectedOption) === Number(problem.correctIndex);
    } else if (kind === "빈칸") {
      ok =
        expected.length > 0 &&
        expected.every(function (answer, index) {
          return looseAnswer(blanks[index]) !== "" && looseAnswer(blanks[index]) === looseAnswer(answer);
        });
    } else {
      const user = isFilledText(blanks[0]) ? blanks[0] : problem.userAnswer;
      ok = expected.length > 0 && looseAnswer(user) !== "" && looseAnswer(user) === looseAnswer(expected[0]);
    }
    scored.push({
      ok,
      wrote,
      kind,
      field: classifyField(problem, lang),
      title: String(problem.title || ""),
      time: Number.isFinite(times[i]) && times[i] > 0 ? times[i] : 0,
    });
  }

  return { lang, scored };
}

export function buildRoomChart(entry, previousEntries) {
  const { lang, scored } = scoreEntryProblems(entry);
  const total = scored.length;
  const correct = scored.filter(function (item) {
    return item.ok;
  }).length;
  const missed = Math.max(0, total - correct);
  const solveRate = percent(correct, total);

  const typeStats = {};
  const fieldStats = {};
  scored.forEach(function (item) {
    if (!typeStats[item.kind]) typeStats[item.kind] = { ok: 0, total: 0 };
    typeStats[item.kind].total += 1;
    if (item.ok) typeStats[item.kind].ok += 1;
    if (!fieldStats[item.field]) fieldStats[item.field] = { ok: 0, total: 0 };
    fieldStats[item.field].total += 1;
    if (item.ok) fieldStats[item.field].ok += 1;
  });

  const weakestType = Object.keys(typeStats)
    .map(function (key) {
      return {
        key,
        rate: percent(typeStats[key].ok, typeStats[key].total),
        missed: typeStats[key].total - typeStats[key].ok,
      };
    })
    .sort(function (a, b) {
      return a.rate - b.rate || b.missed - a.missed;
    })[0];

  const fieldRows = Object.keys(fieldStats)
    .map(function (key) {
      return {
        key,
        rate: percent(fieldStats[key].ok, fieldStats[key].total),
        ok: fieldStats[key].ok,
        total: fieldStats[key].total,
      };
    })
    .sort(function (a, b) {
      return a.rate - b.rate;
    });
  const weakestField = fieldRows[0];
  const strongestField = fieldRows[fieldRows.length - 1];
  const knowledgeScore = fieldRows.length
    ? Math.round(
        avg(
          fieldRows.map(function (row) {
            return row.rate;
          }),
        ) * 10,
      ) / 10
    : solveRate;

  const mid = Math.max(1, Math.ceil(total / 2));
  const early = scored.slice(0, mid);
  const late = scored.slice(mid);
  const earlyRate = percent(
    early.filter(function (item) {
      return item.ok;
    }).length,
    early.length,
  );
  const lateRate = percent(
    late.filter(function (item) {
      return item.ok;
    }).length,
    late.length,
  );
  let maxWrongStreak = 0;
  let streak = 0;
  scored.forEach(function (item) {
    if (item.ok) {
      streak = 0;
      return;
    }
    streak += 1;
    if (streak > maxWrongStreak) maxWrongStreak = streak;
  });
  const recordedTimes = scored
    .map(function (item) {
      return item.time;
    })
    .filter(function (n) {
      return n > 0;
    });
  const timeSpread = recordedTimes.length ? stddev(recordedTimes) : 0;
  let consistencyScore = 100;
  if (late.length && earlyRate - lateRate > 15) {
    consistencyScore -= Math.min(25, (earlyRate - lateRate) * 0.4);
  }
  if (maxWrongStreak >= 3) {
    consistencyScore -= Math.min(20, maxWrongStreak * 5);
  }
  if (recordedTimes.length >= 2) {
    const meanTime = avg(recordedTimes) || 1;
    consistencyScore -= Math.min(20, (timeSpread / meanTime) * 25);
  }
  consistencyScore = Math.max(0, Math.min(100, Math.round(consistencyScore * 10) / 10));

  const previous = Array.isArray(previousEntries) ? previousEntries : [];
  const prevRates = previous
    .map(function (item) {
      const scoredPrev = scoreEntryProblems(item).scored;
      if (!scoredPrev.length) return null;
      return percent(
        scoredPrev.filter(function (row) {
          return row.ok;
        }).length,
        scoredPrev.length,
      );
    })
    .filter(function (n) {
      return n != null;
    });
  const prevAvg = prevRates.length ? avg(prevRates) : null;
  const weakRate = weakestField ? weakestField.rate : solveRate;
  let growthScore = Math.max(
    20,
    Math.min(100, Math.round((55 + (100 - weakRate) * 0.35) * 10) / 10),
  );
  if (prevAvg != null) {
    growthScore = Math.max(
      20,
      Math.min(
        100,
        Math.round((50 + (solveRate - prevAvg) * 0.5 + (100 - weakRate) * 0.2) * 10) / 10,
      ),
    );
  }

  const typeLine = Object.keys(typeStats)
    .map(function (key) {
      return key + " " + percent(typeStats[key].ok, typeStats[key].total) + "%";
    })
    .join(" · ");
  const fieldLine = fieldRows
    .map(function (row) {
      return row.key + " " + row.rate + "%";
    })
    .join(" · ");
  const weakTitle = weakestField
    ? weakestField.key + (weakestType && weakestType.missed > 0 ? " " + weakestType.key : "")
    : "취약 분야";

  return {
    roomId: entry?.roomId ? String(entry.roomId) : "",
    lang,
    problemCount: total,
    winrate: solveRate,
    solveRate,
    ratingScore: 0,
    avgSolveTimeSec: recordedTimes.length ? Math.round(avg(recordedTimes)) : 0,
    totalWins: correct,
    losses: missed,
    recentMatchCount: 1,
    axes: [
      {
        label: "정확도",
        value: solveRate,
        detail: correct + "/" + total + " · 오답 " + missed,
        why:
          (solveRate >= 70 && weakestType && weakestType.rate + 20 <= solveRate
            ? "전체 정답률은 높지만 " +
              weakestType.key +
              " 관련 문제에서 오답이 집중되었습니다."
            : total + "문제 중 " + correct + "문제를 맞혀 정답률은 " + solveRate + "%입니다.") +
          (typeLine ? "\n유형별: " + typeLine : ""),
      },
      {
        label: "지식 숙련도",
        value: knowledgeScore,
        detail: fieldLine || lang,
        why:
          strongestField && weakestField && strongestField.key !== weakestField.key
            ? strongestField.key +
              " 기초 지식은 안정적이나 " +
              weakestField.key +
              " 관련 문제는 추가 학습이 필요합니다."
            : (strongestField
                ? strongestField.key + " 분야 정답률은 " + strongestField.rate + "%입니다."
                : "이 방의 출제 분야 정답률입니다.") +
              "\n객관식과 단답형은 별도 축이 아니라 분야 안의 보조 정보로만 봤습니다.",
      },
      {
        label: "일관성",
        value: consistencyScore,
        detail:
          "초반 " +
          earlyRate +
          "% · 후반 " +
          lateRate +
          "%" +
          (recordedTimes.length ? " · 시간 편차 " + formatSeconds(timeSpread) : ""),
        why:
          recordedTimes.length >= 2 && timeSpread > avg(recordedTimes) * 0.35
            ? "후반부에서 응답 시간의 편차가 커졌습니다. 문제 난이도 변화도 함께 확인할 필요가 있습니다."
            : "초반 정답률 " +
              earlyRate +
              "%, 후반 " +
              lateRate +
              "%" +
              (maxWrongStreak >= 2 ? ", 연속 오답 " + maxWrongStreak + "회" : "") +
              "입니다.\n문항 순서가 무작위일 수 있어 초반·후반만으로 집중력 저하라고 단정하지 않았습니다.",
      },
      {
        label: "성장 가능성",
        value: growthScore,
        detail: prevAvg == null ? "이번 경기 기준" : "이전 평균 " + Math.round(prevAvg) + "%",
        why:
          (prevAvg == null
            ? "이전 경기 기록이 없어 이번 경기 기준으로 제안합니다. "
            : solveRate >= prevAvg
              ? "이전 경기 평균 정답률보다 이번 경기가 비슷하거나 낫습니다. "
              : "이전 경기 평균 정답률보다 이번 경기가 낮아, 같은 취약 분야를 먼저 복습하는 편이 좋습니다. ") +
          "다음 경기에서는 " +
          weakTitle +
          " 문제의 정답률을 높이는 데 집중하고, 응답 전 답을 한 번 더 확인해 보세요.",
      },
    ],
  };
}

export function buildMatchAnalysisText(entry, profileSummary, previousEntries) {
  const chart = buildRoomChart(entry, previousEntries);
  const axes = chart.axes || [];
  const pick = function (label, fallback) {
    const axis = axes.find(function (item) {
      return item.label === label;
    });
    if (!axis) return fallback;
    return String(axis.why || "")
      .split("\n")
      .filter(Boolean);
  };
  return [
    sectionText("정확도", pick("정확도", ["이 판 정답률은 " + chart.solveRate + "%입니다."])),
    "",
    sectionText("지식 숙련도", pick("지식 숙련도", ["이 방 언어는 " + (entry?.lang || "UNKNOWN") + "입니다."])),
    "",
    sectionText("일관성", pick("일관성", ["문항 난이도 변화도 함께 확인할 필요가 있습니다."])),
    "",
    sectionText(
      "성장 가능성",
      pick("성장 가능성", [
        (profileSummary?.slowestLang || entry?.lang || "취약 분야") +
          " 문제의 정답률을 다음 경기 목표로 삼으세요.",
      ]),
    ),
  ].join("\n");
}
