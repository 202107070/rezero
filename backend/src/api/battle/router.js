import express from "express";

import {
  acknowledgeResult,
  getActive,
  getReconnect,
  getPending,
  getResult,
  start,
  submitAnswer,
  submitResult,
  activateRevise,
  useItem,
} from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/matches/start", authenticate, start);
router.get("/matches/reconnect", authenticate, getReconnect);
router.get("/matches/active/:roomId", authenticate, getActive);
router.post("/matches/:matchId/answers", authenticate, submitAnswer);
router.post("/matches/:matchId/items/use", authenticate, useItem);
router.post("/matches/:matchId/items/revise", authenticate, activateRevise);
router.post("/matches/:matchId/submit", authenticate, submitResult);
router.get("/matches/:matchId/pending", authenticate, getPending);
router.get("/matches/:matchId/ranking", authenticate, getResult);
router.post("/matches/:matchId/result-seen", authenticate, acknowledgeResult);

export default router;
