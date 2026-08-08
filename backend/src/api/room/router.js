import express from "express";

import {
  create,
  detail,
  join,
  leave,
  list,
  remove,
  start,
} from "./controller.js";
import { checkStart } from "#handler/manageRoomHandler.js";
import { authenticate } from "#middleware/authMiddleware.js";
import { validateGameStartQuery } from "#middleware/manageGameMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.post("/rooms", create);
router.get("/rooms", list);
router.get("/rooms/:id", detail);
router.get("/rooms/:id/can-start", validateGameStartQuery, checkStart);
router.post("/rooms/:id/start", start);
router.post("/rooms/:id/join", join);
router.post("/rooms/:id/leave", leave);
router.delete("/rooms/:id", remove);

export default router;
