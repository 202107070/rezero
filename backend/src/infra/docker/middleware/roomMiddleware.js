import { CreateRoomDto, ToggleReadyDto } from "#docker/dto/roomDto.js";

export function validateCreateRoom(req, res, next) {
  const roomDto = new CreateRoomDto(req.body);
  if (!roomDto.isValid()) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid room creation data." });
  }
  next();
}

export function extractRoomId(req, res, next) {
  const roomId = req.params.roomId || req.query.roomId;
  if (!roomId) {
    return res
      .status(400)
      .json({ success: false, message: "roomId parameter is required." });
  }
  req.targetRoomId = roomId;
  next();
}

export function validateToggleReady(req, res, next) {
  const toggleDto = new ToggleReadyDto(req.body);
  if (!toggleDto.isValid()) {
    return res.status(400).json({
      success: false,
      message: "roomId, userId, and boolean isReady are required.",
    });
  }
  next();
}
