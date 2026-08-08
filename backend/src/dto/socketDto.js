import { socketConfig } from "#config/socketConfig.js";

export function validateJoinRoom(data) {
  if (!data) {
    throw new Error("올바른 roomId가 필요합니다.");
  }
  if (!data.roomId) {
    throw new Error("올바른 roomId가 필요합니다.");
  }
  if (typeof data.roomId !== "string") {
    throw new Error("올바른 roomId가 필요합니다.");
  }
  if (data.roomId.trim() === "") {
    throw new Error("올바른 roomId가 필요합니다.");
  }

  return {
    roomId: data.roomId.trim(),
  };
}

export function validateSendMessage(data) {
  if (!data) {
    throw new Error("메시지를 보낼 roomId가 누락되었습니다.");
  }
  if (!data.roomId) {
    throw new Error("메시지를 보낼 roomId가 누락되었습니다.");
  }
  if (typeof data.roomId !== "string") {
    throw new Error("메시지를 보낼 roomId가 누락되었습니다.");
  }
  if (data.roomId.trim() === "") {
    throw new Error("메시지를 보낼 roomId가 누락되었습니다.");
  }

  if (!data.message) {
    throw new Error("메시지 내용을 입력해 주세요.");
  }
  if (typeof data.message !== "string") {
    throw new Error("메시지 내용을 입력해 주세요.");
  }
  if (data.message.trim() === "") {
    throw new Error("메시지 내용을 입력해 주세요.");
  }

  const trimmedMessage = data.message.trim();

  if (trimmedMessage.length > socketConfig.maxMessageLength) {
    throw new Error(
      `메시지는 최대 ${socketConfig.maxMessageLength}자까지 입력 가능합니다.`,
    );
  }

  return {
    roomId: data.roomId.trim(),
    message: trimmedMessage,
  };
}

export function validateReadyChange(data) {
  if (!data) {
    throw new Error("READY 상태를 변경할 roomId가 필요합니다.");
  }
  if (!data.roomId) {
    throw new Error("READY 상태를 변경할 roomId가 필요합니다.");
  }
  if (typeof data.roomId !== "string") {
    throw new Error("READY 상태를 변경할 roomId가 필요합니다.");
  }
  if (data.roomId.trim() === "") {
    throw new Error("READY 상태를 변경할 roomId가 필요합니다.");
  }

  if (typeof data.isReady !== "boolean") {
    throw new Error("isReady 값은 true 또는 false여야 합니다.");
  }

  return {
    roomId: data.roomId.trim(),
    isReady: data.isReady,
  };
}
