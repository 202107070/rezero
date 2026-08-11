import { GAME_CONTAINER_CONFIG } from "#docker/config/gameConfig.js";

export class CodeRequestDto {
  constructor(data) {
    this.userId = data.userId;
    this.language = data.language;
    this.code = data.code;
    this.roomId = data.roomId;
  }

  isValid() {
    if (!this.userId) return false;
    if (!this.language || typeof this.language !== "string") return false;
    if (this.code === undefined || this.code === null) return false;

    const supportedLangs = Object.keys(GAME_CONTAINER_CONFIG.languages);
    if (!supportedLangs.includes(this.language.toLowerCase())) {
      return false;
    }

    return true;
  }
}

export class CompileResultDto {
  constructor(data) {
    this.submissionId = data.submissionId;
    this.success = data.success;
    this.stdout = data.stdout || "";
    this.stderr = data.stderr || "";
    this.executionTime = data.executionTime || 0;
  }
}

export function validateGameStartRequest(req, res, next) {
  const roomId = req.body.roomId;
  const userId = req.body.userId;
  if (!roomId || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "roomId and userId are required." });
  }
  next();
}
