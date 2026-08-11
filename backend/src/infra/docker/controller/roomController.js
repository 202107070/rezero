import { CreateRoomDto } from "#docker/dto/roomDto.js";
import { roomService } from "#docker/service/roomService.js";

export async function createRoomController(req, res, next) {
  try {
    const roomDto = new CreateRoomDto(req.body);
    if (!roomDto.isValid()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid room creation data." });
    }

    const newRoom = await roomService.createRoom(roomDto);
    return res.status(201).json({
      success: true,
      message: "Room successfully created.",
      data: newRoom,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRoomController(req, res, next) {
  try {
    const roomId = req.targetRoomId;
    const roomDetails = await roomService.getRoomDetails(roomId);
    return res.status(200).json({
      success: true,
      data: roomDetails,
    });
  } catch (error) {
    next(error);
  }
}
