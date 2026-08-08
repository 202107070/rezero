export function validateGameStartQuery(req, res, next) {
  let rawRoomId;
  if (req.params.id) {
    rawRoomId = req.params.id;
  } else {
    rawRoomId = req.query.roomId;
  }

  const roomId = parseInt(rawRoomId, 10);

  if (isNaN(roomId)) {
    return res.status(400).json({
      success: false,
      message: "유효한 roomId가 필요합니다.",
    });
  }

  if (roomId <= 0) {
    return res.status(400).json({
      success: false,
      message: "유효한 roomId가 필요합니다.",
    });
  }

  req.targetRoomId = roomId;
  next();
}
