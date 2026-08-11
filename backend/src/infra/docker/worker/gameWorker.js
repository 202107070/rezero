import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { GAME_CONTAINER_CONFIG } from "#docker/config/gameConfig.js";
import { fileService } from "#docker/service/fileService.js";
import { CompileResultDto } from "#docker/dto/gameDto.js";

const execAsync = promisify(exec);

export const gameWorker = {
  processSubmission: async function (submission) {
    const submissionId = submission.submissionId;
    const userId = submission.userId;
    const language = submission.language;
    const roomId = submission.roomId;

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

    try {
      const ext = fileService.getExt(language);
      const fileName = userId + "." + ext;
      const sourceFilePath = path.join(
        GAME_CONTAINER_CONFIG.sandboxPath,
        fileName,
      );
      const outputFilePath = path.join(
        GAME_CONTAINER_CONFIG.resultboxPath,
        userId + ".out",
      );

      await fs.access(sourceFilePath);

      const result = await this.executeCode(
        language,
        sourceFilePath,
        outputFilePath,
      );
      const stdout = result.stdout;
      const stderr = result.stderr;

      const executionTime = Date.now() - startTime;
      console.log(
        "[GameWorker] Execution completed for submission ID: " + submissionId,
      );

      return new CompileResultDto({
        submissionId: submissionId,
        success: true,
        stdout: stdout,
        stderr: stderr,
        executionTime: executionTime,
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        "[GameWorker] Processing error for submission ID " + submissionId + ":",
        error.message,
      );

      let errorMessage = "Execution failed";
      if (error.message) {
        errorMessage = error.message;
      }

      return new CompileResultDto({
        submissionId: submissionId,
        success: false,
        stdout: "",
        stderr: errorMessage,
        executionTime: executionTime,
      });
    }
  },

  executeCode: async function (language, sourcePath, outputPath) {
    const lang = language.toLowerCase();
    const timeoutMs = 5000;

    let command = "";

    switch (lang) {
      case "c":
        command =
          "gcc " + sourcePath + " -o " + outputPath + " && " + outputPath;
        break;
      case "cpp":
      case "c++":
        command =
          "g++ " + sourcePath + " -o " + outputPath + " && " + outputPath;
        break;
      case "python":
      case "py":
        command = "python3 " + sourcePath;
        break;
      case "java":
        command =
          "javac " +
          sourcePath +
          " && java -cp " +
          path.dirname(sourcePath) +
          " " +
          path.basename(sourcePath, ".java");
        break;
      case "html":
        command = "htmlhint " + sourcePath;
        break;
      case "css":
        command = "stylelint " + sourcePath;
        break;
      default:
        throw new Error("Unsupported execution language: " + language);
    }

    return await execAsync(command, { timeout: timeoutMs });
  },
};
