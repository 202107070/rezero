import { CodeRequestDto } from "#docker/dto/gameDto.js";

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

export function validateCodeSubmission(req, res, next) {
  const codeDto = new CodeRequestDto(req.body);
  if (!codeDto.isValid()) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid code submission request payload or unsupported language.",
    });
  }
  next();
}
