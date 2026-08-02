import { parseCreateRoomRequest } from './dto/createRoomRequestDto.js';
import {
  parseJoinRoomRequest,
  parseRoomId,
} from './dto/joinRoomRequestDto.js';
import {
  createRoom,
  getRoom,
  getRooms,
  joinRoom,
  leaveRoom,
  removeRoom,
} from './service.js';
import { sendSuccess } from '../../utils/responseHelper.js';

export async function create(req, res, next) {
  try {
    const input = parseCreateRoomRequest(req.body);
    const room = await createRoom(input, req.user.id);
    return sendSuccess(res, room, 201);
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const rooms = await getRooms();
    return sendSuccess(res, { rooms });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const roomId = parseRoomId(req.params.id);
    const room = await getRoom(roomId);
    return sendSuccess(res, room);
  } catch (error) {
    return next(error);
  }
}

export async function join(req, res, next) {
  try {
    const roomId = parseRoomId(req.params.id);
    const input = parseJoinRoomRequest(req.body);
    const room = await joinRoom(roomId, req.user.id, input);
    return sendSuccess(res, room);
  } catch (error) {
    return next(error);
  }
}

export async function leave(req, res, next) {
  try {
    const roomId = parseRoomId(req.params.id);
    const result = await leaveRoom(roomId, req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const roomId = parseRoomId(req.params.id);
    const result = await removeRoom(roomId, req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}
