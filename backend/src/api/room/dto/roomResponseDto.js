function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** MySQL TINYINT/BIT 가 Buffer 로 오면 Boolean(buf) 가 항상 true 가 되는 문제 방지 */
function toBool(value) {
  if (Buffer.isBuffer(value)) return value.length > 0 && value[0] === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return value === true || value === 1;
}

export function toParticipantResponse(participant) {
  const displayName =
    (participant.displayName && String(participant.displayName).trim()) ||
    (participant.username && String(participant.username).trim()) ||
    String(participant.userId || "");

  return {
    id: Number(participant.id),
    userId: participant.userId,
    name: displayName,
    displayName,
    username: participant.username ? String(participant.username) : undefined,
    ratingScore: Number(participant.ratingScore ?? 1000),
    slotIndex: Number(participant.slotIndex),
    isHost: toBool(participant.isHost),
    isReady: toBool(participant.isReady),
    language: participant.language,
    character: participant.character,
    status: participant.status,
    joinedAt: toTimestamp(participant.joinedAt),
  };
}

export function toRoomResponse(room, participants) {
  const currentPlayers = Number(room.currentPlayers || 0);
  const maxPlayers = Number(room.maxPlayers);
  const isPrivate = Boolean(room.isPrivate);

  const response = {
    id: Number(room.id),
    title: room.title,
    status: room.status,
    players: `${currentPlayers}/${maxPlayers}`,
    currentPlayers,
    maxPlayers,
    mode: room.mode,
    gameMode: room.gameMode,
    diff: room.difficulty,
    lang: room.language,
    pwd: isPrivate ? 'protected' : '',
    isPrivate,
    count: String(room.problemCount),
    hostUserId: room.hostUserId,
    createdAt: toTimestamp(room.createdAt),
  };

  if (Array.isArray(participants)) {
    response.participants = participants.map(toParticipantResponse);
  }

  return response;
}
