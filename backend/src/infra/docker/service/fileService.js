import fs from "fs/promises";
import path from "path";
import { GAME_CONTAINER_CONFIG } from "#docker/config/gameConfig.js";

const SANDBOX_PATH = GAME_CONTAINER_CONFIG.sandboxPath;

export const fileService = {
  
  getExt: function (language) {
    if (typeof language !== "string" || language.trim().length === 0) {
      throw new Error("지원하지 않는 언어입니다: empty language");
    }

    const lang = language.toLowerCase();
    const langConfig = GAME_CONTAINER_CONFIG.languages[lang];
    if (langConfig) {
      return langConfig.ext;
    }

    throw new Error("지원하지 않는 언어입니다: " + language);
  },

  
  saveSourceCode: async function (userId, language, code) {
    const ext = fileService.getExt(language);
    const fileName = userId + "." + ext;
    const targetPath = path.join(SANDBOX_PATH, fileName);

    try {
      await fs.mkdir(SANDBOX_PATH, { recursive: true });
      console.log("[FileService] Save start --> " + fileName);

      await fs.writeFile(targetPath, code, "utf-8");
      console.log("[FileService] Save complete --> " + targetPath);

      return {
        success: true,
        fileName: fileName,
        targetPath: targetPath,
      };
    } catch (error) {
      console.error("[FileService] Save error:", error.message);
      throw new Error("Source code file creation error: " + error.message);
    }
  },

  
  deleteSourceCode: async function (userId, language) {
    try {
      const ext = fileService.getExt(language);
      const fileName = userId + "." + ext;
      const targetPath = path.join(SANDBOX_PATH, fileName);

      await fs.unlink(targetPath);
      console.log("[FileService] Remove complete: " + fileName);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        return true;
      }
      console.error("[FileService] Remove error:", error.message);
      return false;
    }
  },
};