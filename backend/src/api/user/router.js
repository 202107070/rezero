import express from "express";

import { getMe, getOnlineUsers, login, signup } from "./controller.js";
import { authenticate } from "#middleware/authMiddleware.js";

const router = express.Router();

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/users/me", authenticate, getMe);
router.get("/users/online", authenticate, getOnlineUsers);

export default router;
