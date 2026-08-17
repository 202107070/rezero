export const submissionDto = {
  toCodeSubmissionDto: function (body, userId) {
    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body.");
    }

    const submissionId = body.submissionId;
    const language = body.language;
    const code = body.code;
    const roomId = body.roomId;

    if (!submissionId) {
      throw new Error("Submission ID is required.");
    }

    if (!language || typeof language !== "string") {
      throw new Error("Programming language is required.");
    }

    if (code === undefined || code === null || typeof code !== "string") {
      throw new Error("Source code string is required.");
    }

    if (!roomId) {
      throw new Error("Room ID is required.");
    }

    if (!userId) {
      throw new Error("User ID is required.");
    }

    return {
      submissionId: String(submissionId),
      userId: String(userId),
      language: language.toLowerCase().trim(),
      code: code,
      roomId: String(roomId),
    };
  },
};
