// src/manageRoom/gameStartController.js
import gameStartService from "./gameStartService.js";

class GameStartController {
  async checkRoomCanStart(roomId) {
    const result = await gameStartService.checkCanStart(roomId);
    return {
      success: true,
      data: result,
    };
  }
}

export default new GameStartController();
