import express from "express";
import logger from "morgan";

import battleRouter from "./src/api/battle/router.js";
import healthRouter from "./src/api/health/router.js";
import roomRouter from "./src/api/room/router.js";
import userRouter from "./src/api/user/router.js";
import { createBuildRouter } from './src/api/build/router.js';
import { createSessionService } from './src/api/build/sessionService.js';
import * as battleModel from './src/api/battle/model.js';
import { redisClient } from './src/config/redisConfig.js';
import { authenticate } from './src/middleware/authMiddleware.js';
import { notFoundHandler, errorHandler } from "#handler/errorHandler.js";

process.on("unhandledRejection", function (reason, promise) {
  console.error("Unhandled Rejection 발생:", reason);
});

process.on("uncaughtException", function (err) {
  console.error("Uncaught Exception 발생:", err);
});

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/health", healthRouter);
app.use("/api/v1/health", healthRouter);
app.use("/api/v1", userRouter);
app.use('/api/v1', createBuildRouter({ sessions: createSessionService({ matches: battleModel, redis: redisClient }), authenticate }));
app.use("/api/v1", roomRouter);
app.use("/api/v1", battleRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
