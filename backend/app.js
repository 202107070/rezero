import express from "express";
import logger from "morgan";

import healthRouter from "./src/api/health/router.js";
import roomRouter from "./src/api/room/router.js";
import userRouter from "./src/api/user/router.js";
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
app.use("/api/v1", roomRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
