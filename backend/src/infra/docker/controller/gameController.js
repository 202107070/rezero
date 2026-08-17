import { manageGameManager } from "#docker/manager/manageGameManager.js";
import { saveInfoService } from "#docker/service/saveInfoService.js";

export const gameController = {
  startGame: async function (req, res) {
    try {
      const roomId = req.params.roomId;
      const gameResult = await manageGameManager.startGame(roomId);

      res.status(200).json({
        success: true,
        message: "Game started successfully.",
        data: gameResult,
      });
    } catch (error) {
      console.error("[GameController] startGame error:", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  endGame: async function (req, res) {
    try {
      const matchId = req.body.matchId;
      const roomId = req.body.roomId;
      const winnerId = req.body.winnerId;
      const score = req.body.score;

      const saveResult = await saveInfoService.saveGameResult({
        matchId: matchId,
        roomId: roomId,
        winnerId: winnerId,
        score: score,
      });

      await manageGameManager.stopGame(roomId);

      res.status(200).json({
        success: true,
        message: "Game ended and results saved successfully.",
        data: saveResult,
      });
    } catch (error) {
      console.error("[GameController] endGame error:", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
