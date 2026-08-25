import express from "express";

import { start, submitAnswer, useItem } from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/matches/start", authenticate, start);
router.post("/matches/:matchId/answers", authenticate, submitAnswer);
router.post("/matches/:matchId/items/use", authenticate, useItem);

export default router;
