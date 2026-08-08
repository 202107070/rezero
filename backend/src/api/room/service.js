import * as roomModel from "./model.js";
import { toRoomResponse } from "./dto/roomResponseDto.js";
import { redisClient } from "#config/redisConfig.js";
import { AppError } from "#utils/appError.js";
import { comparePassword, hashPassword } from "#utils/cryptoUtils.js";

function roomStateKey(roomId) {
  return `room:${roomId}:state`;
}

function roomParticipantsKey(roomId) {
  return `room:${roomId}:participants`;
}

function roomReadyKey(roomId) {
  return `room:${roomId}:ready`;
}

function roomNotFound() {
  return new AppError(404, "ROOM_NOT_FOUND", "방을 찾을 수 없습니다.");
}

async function saveCreatedRoomState(room, hostUserId) {
  await redisClient
    .multi()
    .hSet(roomStateKey(room.id), {
      status: room.status,
      hostUserId,
      currentPlayers: String(room.currentPlayers),
      maxPlayers: String(room.maxPlayers),
      updatedAt: new Date().toISOString(),
    })
    .sAdd(roomParticipantsKey(room.id), hostUserId)
    .exec();
}

async function saveJoinedRoomState(roomId, userId, room) {
  await redisClient
    .multi()
    .sAdd(roomParticipantsKey(roomId), userId)
    .hSet(roomStateKey(roomId), {
      status: room.status,
      hostUserId: room.hostUserId,
      currentPlayers: String(room.currentPlayers),
      maxPlayers: String(room.maxPlayers),
      updatedAt: new Date().toISOString(),
    })
    .exec();
}

async function saveLeftRoomState(roomId, userId, result) {
  const transaction = redisClient
    .multi()
    .sRem(roomParticipantsKey(roomId), userId)
    .sRem(roomReadyKey(roomId), userId);

  if (result.roomClosed) {
    transaction.del([
      roomStateKey(roomId),
      roomParticipantsKey(roomId),
      roomReadyKey(roomId),
      `chat:room:${roomId}:recent`,
      `room:kicked:${roomId}`,
    ]);
  } else {
    const room = await roomModel.findRoomById(roomId);
    transaction.hSet(roomStateKey(roomId), {
      status: room.status,
      hostUserId: room.hostUserId,
      currentPlayers: String(result.currentPlayers),
      maxPlayers: String(room.maxPlayers),
      updatedAt: new Date().toISOString(),
    });
  }

  await transaction.exec();
}

async function clearRoomState(roomId) {
  await redisClient.del([
    roomStateKey(roomId),
    roomParticipantsKey(roomId),
    roomReadyKey(roomId),
    `chat:room:${roomId}:recent`,
    `room:kicked:${roomId}`,
  ]);
}

export async function createRoom(input, hostUserId) {
  const passwordHash = input.password ? await hashPassword(input.password) : "";

  const room = await roomModel.createRoomWithHost({
    ...input,
    passwordHash,
    hostUserId,
  });

  try {
    await saveCreatedRoomState(room, hostUserId);
  } catch (error) {
    await roomModel.hardDeleteRoom(room.id);
    throw new AppError(
      503,
      "ROOM_STATE_UNAVAILABLE",
      "방 상태 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  return toRoomResponse(room);
}

export async function getRooms() {
  const rooms = await roomModel.findRooms();
  return rooms.map((room) => toRoomResponse(room));
}

export async function getRoom(roomId) {
  const room = await roomModel.findRoomById(roomId);

  if (!room) {
    throw roomNotFound();
  }

  const participants = await roomModel.findRoomParticipants(roomId);
  return toRoomResponse(room, participants);
}

export async function joinRoom(roomId, userId, input) {
  const room = await roomModel.findRoomWithPassword(roomId);

  if (!room) {
    throw roomNotFound();
  }

  if (room.status !== "WAITING") {
    throw new AppError(
      409,
      "ROOM_ALREADY_STARTED",
      "이미 시작한 방에는 입장할 수 없습니다.",
    );
  }

  if (room.passwordHash) {
    const passwordMatches = input.password
      ? await comparePassword(input.password, room.passwordHash)
      : false;

    if (!passwordMatches) {
      throw new AppError(
        403,
        "ROOM_PASSWORD_INVALID",
        "방 비밀번호가 올바르지 않습니다.",
      );
    }
  }

  const result = await roomModel.addRoomParticipant({
    roomId,
    userId,
    language: input.language || room.language,
    character: input.character || "char1",
  });

  const errors = {
    ROOM_NOT_FOUND: roomNotFound(),
    ROOM_ALREADY_STARTED: new AppError(
      409,
      "ROOM_ALREADY_STARTED",
      "이미 시작한 방에는 입장할 수 없습니다.",
    ),
    ROOM_ALREADY_JOINED: new AppError(
      409,
      "ROOM_ALREADY_JOINED",
      "이미 참가 중인 방입니다.",
    ),
    ROOM_FULL: new AppError(
      409,
      "ROOM_FULL",
      "방의 최대 인원을 초과할 수 없습니다.",
    ),
  };

  if (!result.success) {
    throw (
      errors[result.reason] ||
      new AppError(409, "ROOM_JOIN_FAILED", "방에 입장할 수 없습니다.")
    );
  }

  const updatedRoom = await roomModel.findRoomById(roomId);

  try {
    await saveJoinedRoomState(roomId, userId, updatedRoom);
  } catch (error) {
    await roomModel.leaveRoomAndSelectRandomHost(roomId, userId);
    throw new AppError(
      503,
      "ROOM_STATE_UNAVAILABLE",
      "방 상태 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const participants = await roomModel.findRoomParticipants(roomId);
  return toRoomResponse(updatedRoom, participants);
}

export async function leaveRoom(roomId, userId) {
  const result = await roomModel.leaveRoomAndSelectRandomHost(roomId, userId);

  if (!result.success) {
    if (result.reason === "ROOM_NOT_FOUND") {
      throw roomNotFound();
    }

    throw new AppError(409, "ROOM_NOT_JOINED", "현재 참가 중인 방이 아닙니다.");
  }

  await saveLeftRoomState(roomId, userId, result);

  if (result.roomClosed) {
    return {
      roomId,
      roomClosed: true,
      newHostUserId: null,
    };
  }

  const room = await roomModel.findRoomById(roomId);
  const participants = await roomModel.findRoomParticipants(roomId);

  return {
    roomClosed: false,
    newHostUserId: result.newHostUserId,
    room: toRoomResponse(room, participants),
  };
}

export async function startRoom(roomId, userId) {
  const room = await roomModel.findRoomById(roomId);

  if (!room) {
    throw roomNotFound();
  }

  if (String(room.hostUserId) !== String(userId)) {
    throw new AppError(
      403,
      "ROOM_START_FORBIDDEN",
      "방장만 게임을 시작할 수 있습니다.",
    );
  }

  if (room.status !== "WAITING") {
    throw new AppError(
      409,
      "ROOM_ALREADY_STARTED",
      "대기 중인 방만 게임을 시작할 수 있습니다.",
    );
  }

  const participants = await redisClient.sMembers(roomParticipantsKey(roomId));
  const readyUserIds = await redisClient.sMembers(roomReadyKey(roomId));
  const nonHostUserIds = participants.filter(
    (participantId) => String(participantId) !== String(room.hostUserId),
  );
  const minimumPlayers = room.mode === "1/1" ? 2 : 3;

  if (participants.length < minimumPlayers) {
    throw new AppError(
      409,
      "ROOM_MINIMUM_PLAYERS_REQUIRED",
      `게임 시작에는 최소 ${minimumPlayers}명이 필요합니다.`,
    );
  }

  const readyUserIdSet = new Set(readyUserIds.map(String));
  const allParticipantsReady =
    nonHostUserIds.length > 0 &&
    nonHostUserIds.every((participantId) =>
      readyUserIdSet.has(String(participantId)),
    );

  if (!allParticipantsReady) {
    throw new AppError(
      409,
      "ROOM_PARTICIPANTS_NOT_READY",
      "방장을 제외한 모든 참가자가 READY 상태여야 합니다.",
    );
  }

  const started = await roomModel.markRoomStarted(roomId);

  if (!started) {
    throw new AppError(
      409,
      "ROOM_ALREADY_STARTED",
      "대기 중인 방만 게임을 시작할 수 있습니다.",
    );
  }

  await redisClient.hSet(roomStateKey(roomId), {
    status: "STARTED",
    updatedAt: new Date().toISOString(),
  });

  return {
    roomId,
    status: "STARTED",
    totalPlayers: participants.length,
    readyPlayers: nonHostUserIds.length,
  };
}

export async function removeRoom(roomId, userId) {
  const room = await roomModel.findRoomWithPassword(roomId);

  if (!room) {
    throw roomNotFound();
  }

  if (room.hostUserId !== userId) {
    throw new AppError(
      403,
      "ROOM_DELETE_FORBIDDEN",
      "방장만 방을 삭제할 수 있습니다.",
    );
  }

  if (room.status !== "WAITING") {
    throw new AppError(
      409,
      "ROOM_DELETE_NOT_WAITING",
      "대기 중인 방만 삭제할 수 있습니다.",
    );
  }

  const closed = await roomModel.closeRoom(roomId);

  if (!closed) {
    throw new AppError(
      409,
      "ROOM_DELETE_NOT_WAITING",
      "대기 중인 방만 삭제할 수 있습니다.",
    );
  }

  await clearRoomState(roomId);

  return { roomId, deleted: true };
}
