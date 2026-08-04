// src/manageRoom/manageRoomHandler.js
import manageRoomController from "./manageRoomController.js";
import gameStartController from "./gameStartController.js";

/**
 * GET /rooms (방 목록 조회 핸들러)
 */
export const list = async (req, res, next) => {
  try {
    const limit = req.roomLimit;
    const result = await manageRoomController.fetchRooms(limit);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /rooms/:id/can-start (게임 시작 가능 여부 검사 핸들러)
 */
export const checkStart = async (req, res, next) => {
  try {
    const roomId = req.targetRoomId;
    const result = await gameStartController.checkRoomCanStart(roomId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
