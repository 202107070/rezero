export class CompileResultDto {
  constructor(data) {
    let successValue = false;
    if (data && data.success) {
      successValue = true;
    }

    let executionTimeValue = 0;
    if (data && data.executionTime) {
      executionTimeValue = data.executionTime;
    }

    let outputValue = "";
    if (data && data.output) {
      outputValue = data.output;
    }

    let errorValue = null;
    if (data && data.error) {
      errorValue = data.error;
    }

    this.success = successValue;
    this.executionTime = executionTimeValue;
    this.output = outputValue;
    this.error = errorValue;
  }

  toJSON() {
    return {
      success: this.success,
      executionTime: this.executionTime,
      output: this.output,
      error: this.error,
    };
  }
}

export const gameDto = {
  toStartGameDto: function (params, userId) {
    const roomId = params.roomId;

    if (!roomId) {
      throw new Error("Room ID is required to start game.");
    }

    if (!userId) {
      throw new Error("Host User ID is required.");
    }

    return {
      roomId: String(roomId),
      hostUserId: String(userId),
    };
  },

  toSaveGameResultDto: function (body) {
    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body.");
    }

    const matchId = body.matchId;
    const roomId = body.roomId;
    const winnerId = body.winnerId;
    const score = body.score;

    if (!matchId || typeof matchId !== "string") {
      throw new Error("Valid match ID is required.");
    }

    if (!roomId) {
      throw new Error("Valid room ID is required.");
    }

    let validatedWinnerId = null;
    if (winnerId !== undefined && winnerId !== null) {
      validatedWinnerId = String(winnerId);
    }

    let validatedScore = 0;
    if (typeof score === "number" && !isNaN(score)) {
      validatedScore = score;
    }

    return {
      matchId: matchId,
      roomId: String(roomId),
      winnerId: validatedWinnerId,
      score: validatedScore,
    };
  },
};
