// src/middleware/gameStartMiddleware.js
export const validateGameStartQuery = (req, res, next) => {
  const roomId = parseInt(req.params.id || req.query.roomId, 10);

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({
      success: false,
      message: "유효한 roomId가 필요합니다.",
    });
  }

  req.targetRoomId = roomId;
  next();
};
