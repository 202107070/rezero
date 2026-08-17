export const roomDto = {
  toCreateRoomDto: function (body, userId) {
    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body.");
    }

    const title = body.title;
    const mode = body.mode;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new Error("Room title is required and must be a valid string.");
    }

    let validatedMode = "normal";
    if (mode && typeof mode === "string") {
      validatedMode = mode.toLowerCase();
    }

    if (!userId) {
      throw new Error("Host user ID is required.");
    }

    return {
      title: title.trim(),
      mode: validatedMode,
      hostId: String(userId),
    };
  },

  toToggleReadyDto: function (body, userId) {
    if (!body || typeof body !== "object") {
      throw new Error("Invalid request body.");
    }

    let isReadyValue = false;
    if (body.isReady === true || body.isReady === "true") {
      isReadyValue = true;
    }

    if (!userId) {
      throw new Error("User ID is required.");
    }

    return {
      userId: String(userId),
      isReady: isReadyValue,
    };
  },
};
