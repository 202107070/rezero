import express from "express";

import {
  getMe,
  getMyFriends,
  getMatchHistory,
  getOnlineUsers,
  getPublicProfiles,
  login,
  postMatchHistory,
  postEquippedTitle,
  postRoulette,
  postUserAiAnalysis,
  removeMatchHistory,
  removeMe,
  signup,
} from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/users/me", authenticate, getMe);
router.get("/users/me/friends", authenticate, getMyFriends);
router.delete("/users/me", authenticate, removeMe);
router.post("/users/me/title", authenticate, postEquippedTitle);
router.get("/users/online", authenticate, getOnlineUsers);
router.get("/users/public-profiles", authenticate, getPublicProfiles);
router.post("/users/me/roulette", authenticate, postRoulette);
router.get("/users/me/match-history", authenticate, getMatchHistory);
router.post("/users/me/match-history", authenticate, postMatchHistory);
router.delete("/users/me/match-history", authenticate, removeMatchHistory);
router.post("/users/ai-analysis", authenticate, postUserAiAnalysis);

export default router;
