function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function toParticipantResponse(participant) {
  return {
    id: participant.id,
    userId: participant.userId,
    name: participant.displayName,
    slotIndex: Number(participant.slotIndex),
    isHost: Boolean(participant.isHost),
    isReady: Boolean(participant.isReady),
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
