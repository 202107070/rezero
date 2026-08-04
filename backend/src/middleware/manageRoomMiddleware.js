// src/manageroom/manageRoomMiddleware.js
import { DEFAULT_ROOM_LIMIT } from "../middleware/manageRoomConfig.js";

export const validateRoomQuery = (req, res, next) => {
  const limitParam = parseInt(req.query.limit, 10);
  req.roomLimit =
    isNaN(limitParam) || limitParam <= 0 ? DEFAULT_ROOM_LIMIT : limitParam;
  next();
};
