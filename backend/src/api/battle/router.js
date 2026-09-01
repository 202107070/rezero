import express from "express";

import {
  getResult,
  start,
  submitAnswer,
  submitResult,
  useItem,
} from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/matches/start", authenticate, start);
router.post("/matches/:matchId/answers", authenticate, submitAnswer);
router.post("/matches/:matchId/items/use", authenticate, useItem);
router.post("/matches/:matchId/submit", authenticate, submitResult);
router.get("/matches/:matchId/ranking", authenticate, getResult);

export default router;
