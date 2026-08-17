function toPublicProblem(problem) {
  return {
    id: problem.id,
    type: problem.type,
    difficulty: problem.difficulty,
    title: problem.title,
    question: problem.question,
    options: problem.options,
    correctIndex: problem.correctIndex,
    explanation: problem.explanation,
    description: problem.description,
    input: problem.input,
    output: problem.output,
    visual: problem.visual,
    capabilityOverrides: problem.capabilityOverrides,
  };
}

export function toMatchStartResponse(match) {
  return {
    matchId: match.id,
    roomId: Number(match.roomId),
    status: match.status,
    language: match.language,
    difficulty: match.difficulty,
    problemCount: Number(match.problemCount),
    maxPlayers: Number(match.maxPlayers),
    roomMode: match.roomMode,
    gameMode: match.gameMode,
    roundSeconds: Number(match.roundSeconds),
    startedAt: match.startedAt,
    problems: match.problems.map(toPublicProblem),
  };
}
