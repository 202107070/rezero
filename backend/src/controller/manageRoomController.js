import manageRoomService from "#service/manageRoomService.js";

class ManageRoomController {
  async fetchRooms(limit) {
    const rooms = await manageRoomService.getRooms(limit);
    return {
      success: true,
      data: rooms,
    };
  }
}

export default new ManageRoomController();
