import manageRoomController from "#controller/manageRoomController.js";
import gameStartController from "#controller/manageGameController.js";
import { sendSuccess } from "#utils/responseHelper.js";

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
    const data = result?.data ?? result;
    return sendSuccess(res, {
      canStart: Boolean(data?.canStart ?? result?.success),
      reason: data?.reason ?? result?.message ?? null,
      totalPlayers: Number(data?.playerSummary?.totalPlayers ?? data?.totalPlayers ?? 0),
      nonHostPlayers: Number(
        data?.playerSummary?.nonHostPlayers ?? data?.nonHostPlayers ?? 0,
      ),
      readyNonHostPlayers: Number(
        data?.playerSummary?.readyNonHostPlayers ?? data?.readyNonHostPlayers ?? 0,
      ),
      roomId: Number(data?.roomId ?? roomId),
    });
  } catch (error) {
    next(error);
  }
}
