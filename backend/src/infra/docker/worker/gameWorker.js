import fs from "fs/promises";
import path from "path";
import { CompileResultDto } from "#docker/dto/gameDto.js";

class GameWorker {
  async processSubmission(submission) {
    const submissionId = submission.submissionId;
    const userId = submission.userId;
    const roomId = submission.roomId;
    const language = submission.language;
    const code = submission.code;

    console.log(
      "[GameWorker] Processing submission ID: " +
        submissionId +
        " for language: " +
        language +
        " (User: " +
        userId +
        ", Room: " +
        roomId +
        ")",
    );

    const startTime = Date.now();
    const sandboxDir = "/home/shared/fileShare/sandbox";
    const filePath = path.join(sandboxDir, userId + ".py");

    try {
      await fs.mkdir(sandboxDir, { recursive: true });

      await fs.writeFile(filePath, code, "utf-8");

      const executionTime = Date.now() - startTime;

      return new CompileResultDto({
        success: true,
        executionTime: executionTime,
        output: "Hello Battle " + userId,
        error: null,
      }).toJSON();
    } catch (error) {
      console.error(
        "[GameWorker] Processing error for submission ID " +
          submissionId +
          ": " +
          error.message,
      );

      const executionTime = Date.now() - startTime;

      return new CompileResultDto({
        success: false,
        executionTime: executionTime,
        output: "",
        error: error.message,
      }).toJSON();
    }
  }
}

export const gameWorker = new GameWorker();
