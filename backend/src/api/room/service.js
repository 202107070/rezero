import * as roomModel from "./model.js";
import { toRoomResponse } from "./dto/roomResponseDto.js";
import { redisClient } from "#config/redisConfig.js";
import { AppError } from "#utils/appError.js";
import { comparePassword, hashPassword } from "#utils/cryptoUtils.js";
import { getSocket } from "#config/socketConfig.js";
import { SOCKET_EVENTS } from "#constants/socketEvents.js";

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
      `room:${roomId}:messages`,
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
    `room:${roomId}:messages`,
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
  // 목록 조회 시 유령 WAITING 방 정리 (스로틀)
  try {
    await closeStaleRooms({ maxAgeHours: 6 });
  } catch (error) {
    console.error("[getRooms] closeStaleRooms: " + (error.message || error));
  }

  const rooms = await roomModel.findRooms();
  return rooms
    .filter((room) => {
      // WAITING 이면서 활성 참가자가 0명이면 목록에서 제외
      if (room.status === "WAITING" && Number(room.currentPlayers || 0) <= 0) {
        return false;
      }
      return true;
    })
    .map((room) => toRoomResponse(room));
}

const STALE_CLEANUP_COOLDOWN_MS = 60_000;
let lastStaleCleanupAt = 0;

/**
 * 유령 WAITING 방 정리:
 * - 활성 참가자 0명
 * - 또는 N시간 이상 경과하고 소켓/참가자가 없는 방
 */
export async function closeStaleRooms(options = {}) {
  const maxAgeHours = Number(options.maxAgeHours) || 6;
  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && now - lastStaleCleanupAt < STALE_CLEANUP_COOLDOWN_MS) {
    return { closed: 0, skipped: true };
  }
  lastStaleCleanupAt = now;

  const rooms = await roomModel.findRooms();
  let closed = 0;
  const cutoffMs = maxAgeHours * 60 * 60 * 1000;

  for (const room of rooms) {
    if (room.status !== "WAITING" && room.status !== "STARTED") continue;
    const players = Number(room.currentPlayers || 0);
    const createdAt = room.createdAt ? new Date(room.createdAt).getTime() : 0;
    const isOld = createdAt > 0 && now - createdAt >= cutoffMs;

    // 빈 방 즉시 정리, 오래된 유령방(참가자 남아 있어도) 강제 종료
    const shouldClose =
      players <= 0 ||
      (isOld && room.status === "WAITING") ||
      (isOld && room.status === "STARTED");

    if (!shouldClose) continue;

    try {
      const ok = await roomModel.closeRoom(room.id);
      if (ok) {
        closed += 1;
        try {
          await redisClient.del(roomStateKey(room.id));
          await redisClient.del(roomParticipantsKey(room.id));
          await redisClient.del(roomReadyKey(room.id));
        } catch {
          // ignore redis cleanup
        }
      }
    } catch {
      // ignore individual room errors
    }
  }

  return { closed, skipped: false };
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
  const roomBefore = await roomModel.findRoomById(roomId);
  const result = await roomModel.leaveRoomAndSelectRandomHost(roomId, userId);

  if (!result.success) {
    if (result.reason === "ROOM_NOT_FOUND") {
      throw roomNotFound();
    }

    throw new AppError(409, "ROOM_NOT_JOINED", "현재 참가 중인 방이 아닙니다.");
  }

  await saveLeftRoomState(roomId, userId, result);

  const io = getSocket();
  const remainingPlayers = Number(result.currentPlayers || 0);
  const wasStarted = roomBefore && roomBefore.status === "STARTED";
  const abandonNoPlayers =
    wasStarted && !result.roomClosed && remainingPlayers <= 1;

  if (io) {
    io.to(String(roomId)).emit(SOCKET_EVENTS.USER_LEFT, {
      roomId: String(roomId),
      userId: String(userId),
      roomClosed: Boolean(result.roomClosed),
      newHostUserId: result.newHostUserId ? String(result.newHostUserId) : null,
      remainingPlayers,
    });

    if (abandonNoPlayers) {
      const abandonMessage = "유저가 남아있지 않아 대기실로 이동합니다.";
      io.to(String(roomId)).emit(SOCKET_EVENTS.GAME_ENDED, {
        roomId: String(roomId),
        reason: "no_players",
        message: abandonMessage,
      });
      try {
        await roomModel.markRoomWaiting(roomId);
      } catch {
        // ignore
      }
    }
  }

  if (result.roomClosed) {
    return {
      roomId,
      roomClosed: true,
      newHostUserId: null,
      remainingPlayers: 0,
    };
  }

  const room = await roomModel.findRoomById(roomId);
  const participants = await roomModel.findRoomParticipants(roomId);

  return {
    roomClosed: false,
    newHostUserId: result.newHostUserId,
    remainingPlayers,
    room: toRoomResponse(room, participants),
  };
}

export async function kickParticipant(roomId, hostUserId, targetUserId) {
  const result = await roomModel.kickRoomParticipant(roomId, hostUserId, targetUserId);

  if (!result.success) {
    if (result.reason === "ROOM_NOT_FOUND") throw roomNotFound();
    if (result.reason === "ROOM_KICK_FORBIDDEN") {
      throw new AppError(403, "ROOM_KICK_FORBIDDEN", "방장만 강퇴할 수 있습니다.");
    }
    if (result.reason === "ROOM_ALREADY_STARTED") {
      throw new AppError(409, "ROOM_ALREADY_STARTED", "게임 중에는 강퇴할 수 없습니다.");
    }
    if (result.reason === "ROOM_KICK_SELF") {
      throw new AppError(400, "ROOM_KICK_SELF", "자기 자신은 강퇴할 수 없습니다.");
    }
    throw new AppError(409, "ROOM_NOT_JOINED", "강퇴 대상이 방에 없습니다.");
  }

  await saveLeftRoomState(roomId, targetUserId, {
    roomClosed: false,
    currentPlayers: result.currentPlayers,
  });

  try {
    await redisClient.sAdd(`room:kicked:${roomId}`, String(targetUserId));
  } catch {
    // ignore
  }

  const io = getSocket();
  if (io) {
    const payload = {
      roomId: String(roomId),
      userId: String(targetUserId),
      kickedBy: String(hostUserId),
      roomClosed: false,
      newHostUserId: null,
    };
    io.to(String(roomId)).emit(SOCKET_EVENTS.USER_KICKED, payload);
    io.to("user:" + String(targetUserId)).emit(SOCKET_EVENTS.USER_KICKED, payload);
    io.to(String(roomId)).emit(SOCKET_EVENTS.USER_LEFT, {
      roomId: String(roomId),
      userId: String(targetUserId),
      roomClosed: false,
      newHostUserId: null,
      kicked: true,
    });
  }

  const room = await roomModel.findRoomById(roomId);
  const participants = await roomModel.findRoomParticipants(roomId);
  return {
    roomClosed: false,
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
