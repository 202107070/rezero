import express from "express";

import {
  getMe,
  getMatchHistory,
  getOnlineUsers,
  login,
  postMatchHistory,
  postRoulette,
  removeMatchHistory,
  signup,
} from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/users/me", authenticate, getMe);
router.get("/users/online", authenticate, getOnlineUsers);
router.post("/users/me/roulette", authenticate, postRoulette);
router.get("/users/me/match-history", authenticate, getMatchHistory);
router.post("/users/me/match-history", authenticate, postMatchHistory);
router.delete("/users/me/match-history", authenticate, removeMatchHistory);

export default router;
