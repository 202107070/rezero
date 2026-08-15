import { DEFAULT_ROOM_LIMIT } from "#config/manageRoomConfig.js";

export function validateRoomQuery(req, res, next) {
  const limitParam = parseInt(req.query.limit, 10);
  let resolvedLimit;
  if (isNaN(limitParam)) {
    resolvedLimit = DEFAULT_ROOM_LIMIT;
  } else {
    if (limitParam <= 0) {
      resolvedLimit = DEFAULT_ROOM_LIMIT;
    } else {
      resolvedLimit = limitParam;
    }
  }
  req.roomLimit = resolvedLimit;
  next();
}
