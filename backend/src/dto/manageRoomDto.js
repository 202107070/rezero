import { ROOM_STATUS } from "#config/manageRoomConfig.js";

export class ManageRoomDto {
  constructor(room) {
    this.roomId = room.id;
    this.title = room.title;
    this.status = room.status;
    this.mode = room.mode;
    this.gameMode = room.game_mode;
    this.difficulty = room.difficulty;
    this.language = room.language;
    this.problemCount = room.problem_count;
    this.hostUserId = room.host_user_id;
    this.createdAt = room.created_at;

    this.currentPlayers = parseInt(room.current_players || 0, 10);
    this.maxPlayers = parseInt(room.max_players || 0, 10);

    this.isLocked = Boolean(room.password && room.password.trim() !== "");
    this.isJoinable = this.calculateIsJoinable();
  }

  calculateIsJoinable() {
    if (this.status === ROOM_STATUS.STARTED) {
      return false;
    }
    if (this.currentPlayers >= this.maxPlayers) {
      return false;
    }
    return true;
  }

  toJSON() {
    return {
      roomId: this.roomId,
      title: this.title,
      status: this.status,
      mode: this.mode,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      language: this.language,
      problemCount: this.problemCount,
      hostUserId: this.hostUserId,
      createdAt: this.createdAt,
      currentPlayers: this.currentPlayers,
      maxPlayers: this.maxPlayers,
      isLocked: this.isLocked,
      isJoinable: this.isJoinable,
    };
  }
}
