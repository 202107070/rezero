import express from "express";
import {
  create,
  detail,
  join,
  leave,
  list,
  remove,
} from "../../manageroom/manageRoomHandler.js"; // 또는 controller 위치에 맞춰 지정
import { validateRoomQuery } from "../../middleware/manageRoomMiddleware.js";
import { authenticate } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticate);

router.post("/rooms", create);
router.get("/rooms", validateRoomQuery, list); // validateRoomQuery 미들웨어 적용
router.get("/rooms/:id", detail);
router.post("/rooms/:id/join", join);
router.post("/rooms/:id/leave", leave);
router.delete("/rooms/:id", remove);

export default router;
