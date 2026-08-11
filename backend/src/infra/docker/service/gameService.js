import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { GAME_CONTAINER_CONFIG } from "#docker/config/gameConfig.js";
import { fileService } from "#docker/service/fileService.js";

const execAsync = promisify(exec);

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

    const runCmd =
      "podman run -d --name " +
      containerName +
      " -p " +
      allocatedPort +
      ":4000 -v " +
      hostDbPath +
      ":/usr/src/gameroom/db:rw " +
      GAME_CONTAINER_CONFIG.baseImage;

    try {
      console.log("[GameService] Starting room container: " + containerName);
      await execAsync(runCmd);
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
