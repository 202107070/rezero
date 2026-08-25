import { socketConfig } from "#config/socketConfig.js";

export function validateJoinRoom(data) {
  if (!data || !data.roomId) {
    throw new Error("올바른 roomId가 필요합니다.");
  }
  const roomIdStr = String(data.roomId).trim();
  if (roomIdStr === "") {
    throw new Error("올바른 roomId가 필요합니다.");
  }

  return {
    roomId: roomIdStr,
  };
}

export function validateSendMessage(data) {
  if (!data || !data.roomId) {
    throw new Error("메시지를 보낼 roomId가 누락되었습니다.");
  }
  if (
    !data.message ||
    typeof data.message !== "string" ||
    data.message.trim() === ""
  ) {
    throw new Error("메시지 내용을 입력해 주세요.");
  }

  const trimmedMessage = data.message.trim();
  if (trimmedMessage.length > socketConfig.maxMessageLength) {
    throw new Error(
      "메시지는 최대 " +
        socketConfig.maxMessageLength +
        "자까지 입력 가능합니다.",
    );
  }

  return {
    roomId: String(data.roomId).trim(),
    message: trimmedMessage,
  };
}

export function validateReadyChange(data) {
  if (!data || !data.roomId) {
    throw new Error("READY 상태를 변경할 roomId가 필요합니다.");
  }
  if (typeof data.isReady !== "boolean") {
    throw new Error("isReady 값은 true 또는 false여야 합니다.");
  }

  return {
    roomId: String(data.roomId).trim(),
    isReady: data.isReady,
  };
}

export function validateSubmitCode(data) {
  if (!data || !data.roomId) {
    throw new Error("roomId가 필요합니다.");
  }
  if (!data.code || typeof data.code !== "string") {
    throw new Error("제출할 코드가 올바르지 않습니다.");
  }
  if (!data.language) {
    throw new Error("언어(language) 정보가 필요합니다.");
  }

  return {
    roomId: String(data.roomId).trim(),
    code: data.code,
    language: data.language,
    questionId: data.questionId,
  };
}

export function validateUseItem(data) {
  if (!data || !data.roomId) {
    throw new Error("roomId가 필요합니다.");
  }
  if (!data.itemType) {
    throw new Error("사용할 아이템 타입이 필요합니다.");
  }

  let targetUserId = null;
  if (data.targetUserId) {
    targetUserId = data.targetUserId;
  }

  return {
    roomId: String(data.roomId).trim(),
    targetUserId: targetUserId,
    itemType: data.itemType,
  };
}

export const socketDto = {
  toGameStateResponse: function (params) {
    return {
      roomId: params.roomId,
      question: params.question,
      remainingTime: params.remainingTime,
      scores: params.scores,
      submitStatuses: params.submitStatuses,
    };
  },

  toExecResultResponse: function (params) {
    return {
      userId: params.userId,
      executionResult: params.executionResult,
      isCorrect: params.isCorrect,
      timestamp: new Date().toISOString(),
    };
  },

  toItemResultResponse: function (params) {
    return {
      fromUserId: params.fromUserId,
      targetUserId: params.targetUserId,
      itemType: params.itemType,
      success: params.success,
      effectDetails: params.effectDetails,
      timestamp: new Date().toISOString(),
    };
  },

  toNextQuestionResponse: function (params) {
    return {
      roomId: params.roomId,
      question: params.question,
      remainingTime: params.timeLimit,
      questionIndex: params.questionIndex,
    };
  },
};
