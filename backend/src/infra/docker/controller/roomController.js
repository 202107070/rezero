import { manageRoomManager } from "#docker/manager/manageRoomManager.js";

export const roomController = {
  createRoom: async function (req, res) {
    try {
      const title = req.body.title;
      const mode = req.body.mode;
      const hostId = req.user.id;

      const roomData = await manageRoomManager.createRoom({
        title: title,
        mode: mode,
        hostId: hostId,
      });

      res.status(201).json({
        success: true,
        data: roomData,
      });
    } catch (error) {
      console.error("[RoomController] createRoom error:", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  getRoomDetails: async function (req, res) {
    try {
      const roomId = req.params.roomId;
      const details = await manageRoomManager.getRoomDetails(roomId);

      res.status(200).json({
        success: true,
        data: details,
      });
    } catch (error) {
      console.error("[RoomController] getRoomDetails error:", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
