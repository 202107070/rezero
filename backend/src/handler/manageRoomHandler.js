import manageRoomController from "#controller/manageRoomController.js";
import gameStartController from "#controller/manageGameController.js";

export async function list(req, res, next) {
  try {
    const limit = req.roomLimit;
    const result = await manageRoomController.fetchRooms(limit);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function checkStart(req, res, next) {
  try {
    const roomId = req.targetRoomId;
    const result = await gameStartController.checkRoomCanStart(roomId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
