import express from "express";

import {
  getActive,
  getResult,
  start,
  submitAnswer,
  submitResult,
  useItem,
} from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/matches/start", authenticate, start);
router.get("/matches/active/:roomId", authenticate, getActive);
router.post("/matches/:matchId/answers", authenticate, submitAnswer);
router.post("/matches/:matchId/items/use", authenticate, useItem);
router.post("/matches/:matchId/submit", authenticate, submitResult);
router.get("/matches/:matchId/ranking", authenticate, getResult);

export default router;
