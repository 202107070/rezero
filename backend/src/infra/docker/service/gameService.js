import { exec, execFile } from "child_process";
import fs from "node:fs/promises";
import { promisify } from "util";
import path from "path";
import { GAME_CONTAINER_CONFIG } from "#docker/config/gameConfig.js";
import { fileService } from "#docker/service/fileService.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function addContainerEnvironment(args, name, value) {
  if (value !== undefined && value !== "") {
    args.push("-e", name + "=" + value);
  }
}

export const gameService = {
  buildBaseImage: async function () {
    const contextPath = GAME_CONTAINER_CONFIG.build.contextPath;
    const dockerfilePath = GAME_CONTAINER_CONFIG.build.dockerfilePath;
    const imageTag = GAME_CONTAINER_CONFIG.build.imageTag;
    const cmd =
      "podman build -t " +
      imageTag +
      " -f " +
      dockerfilePath +
      " " +
      contextPath;

    try {
      console.log("[GameService] Building base image: " + imageTag + "...");
      const result = await execAsync(cmd);
      const stdout = result.stdout;
      const stderr = result.stderr;
      console.log("[GameService] Build success:", stdout);
      return {
        success: true,
        imageTag: imageTag,
        stdout: stdout,
        stderr: stderr,
      };
    } catch (error) {
      console.error("[GameService] Image build failed:", error.message);
      throw new Error("Base image build error: " + error.message);
    }
  },

  createRoomContainer: async function (roomId, allocatedPort) {
    const containerName = "gameroom_container_" + roomId;
    const hostDbPath = path.resolve(
      GAME_CONTAINER_CONFIG.sandboxPath,
      "../gameroom_dbs/" + roomId,
    );

    await fs.mkdir(hostDbPath, { recursive: true });

    const runArgs = [
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      allocatedPort + ":8080",
      "--add-host",
      "host.containers.internal:host-gateway",
      "-v",
      hostDbPath + ":/usr/src/gameroom/db:rw",
    ];

    addContainerEnvironment(runArgs, "NODE_ENV", process.env.NODE_ENV);
    addContainerEnvironment(runArgs, "HOST", "0.0.0.0");
    addContainerEnvironment(runArgs, "PORT", "8080");
    addContainerEnvironment(
      runArgs,
      "DB_HOST",
      "host.containers.internal",
    );
    addContainerEnvironment(runArgs, "DB_PORT", process.env.DB_PORT || "3306");
    addContainerEnvironment(runArgs, "DB_USER", process.env.DB_USER);
    addContainerEnvironment(runArgs, "DB_PASSWORD", process.env.DB_PASSWORD);
    addContainerEnvironment(runArgs, "DB_NAME", process.env.DB_NAME);
    addContainerEnvironment(
      runArgs,
      "DB_CONNECTION_LIMIT",
      process.env.DB_CONNECTION_LIMIT,
    );
    addContainerEnvironment(
      runArgs,
      "REDIS_HOST",
      "host.containers.internal",
    );
    addContainerEnvironment(
      runArgs,
      "REDIS_PORT",
      process.env.REDIS_PORT || "6379",
    );
    addContainerEnvironment(
      runArgs,
      "REDIS_PASSWORD",
      process.env.REDIS_PASSWORD,
    );
    addContainerEnvironment(runArgs, "JWT_SECRET", process.env.JWT_SECRET);
    addContainerEnvironment(
      runArgs,
      "JWT_EXPIRES_IN",
      process.env.JWT_EXPIRES_IN,
    );

    runArgs.push(GAME_CONTAINER_CONFIG.baseImage);

    try {
      console.log("[GameService] Starting room container: " + containerName);
      await execFileAsync("podman", runArgs);
      return { success: true, containerName: containerName };
    } catch (error) {
      console.error(
        "[GameService] Container start error for room " + roomId + ":",
        error.message,
      );
      throw new Error("Failed to create room container: " + error.message);
    }
  },

  destroyRoomContainer: async function (roomId) {
    const containerName = "gameroom_container_" + roomId;
    try {
      await execAsync("podman stop " + containerName);
      await execAsync("podman rm " + containerName);
      console.log("[GameService] Destroyed container: " + containerName);
    } catch (error) {
      console.error(
        "Container destruction error for room " + roomId + ":",
        error.message,
      );
    }
  },

  processCodeSubmission: async function (data) {
    const submissionId = data.submissionId;
    const userId = data.userId;
    const language = data.language;
    const code = data.code;
    const roomId = data.roomId;

    console.log(
      "[GameService] Processing submission " +
        submissionId +
        " for user " +
        userId,
    );

    const saveResult = await fileService.saveSourceCode(userId, language, code);
    return Object.assign({ submissionId: submissionId }, saveResult);
  },
};
