import { ROOM_CONFIG } from "#docker/config/roomConfig.js";

export class CreateRoomDto {
  constructor(data) {
    this.title = data.title;
    this.mode = data.mode || "default";
    this.hostId = data.hostId;
  }

  isValid() {
    if (
      !this.title ||
      typeof this.title !== "string" ||
      this.title.trim() === ""
    ) {
      return false;
    }
    if (!this.mode || typeof this.mode !== "string") {
      return false;
    }
    if (!this.hostId) {
      return false;
    }
    return true;
  }
}

export class ToggleReadyDto {
  constructor(data) {
    this.roomId = data.roomId;
    this.userId = data.userId;
    this.isReady = data.isReady;
  }

  isValid() {
    if (!this.roomId || !this.userId) {
      return false;
    }
    if (typeof this.isReady !== "boolean") {
      return false;
    }
    return true;
  }
}
