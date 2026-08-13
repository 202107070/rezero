import express from "express";

import { start } from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/matches/start", authenticate, start);

export default router;
