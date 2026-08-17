import path from "path";
import dotenv from "dotenv";

dotenv.config();

const currentDirectory = import.meta.dirname;
const backendDirectory = path.resolve(currentDirectory, "../../../..");
const projectRoot = path.resolve(backendDirectory, "..");

let sharedDirectory;
if (process.env.SHARED_DIR) {
  sharedDirectory = path.resolve(process.env.SHARED_DIR);
} else {
  sharedDirectory = path.resolve(backendDirectory, "../../../shared/fileShare");
}

export const GAME_CONTAINER_CONFIG = {
  containerName: "build_compiler_sandbox",
  baseImage: "gameroom-base-image",
  sandboxPath: path.resolve(sharedDirectory, "sandbox"),
  resultboxPath: path.resolve(sharedDirectory, "resultbox"),

  build: {
    contextPath: projectRoot,
    dockerfilePath: path.resolve(
      backendDirectory,
      "src/infra/docker/dockerimage/game.Dockerfile",
    ),
    imageTag: "gameroom-base-image:latest",
    buildOptions: ["--no-cache"],
  },

  languages: {
    c: { compiler: "gcc", ext: "c" },
    cpp: { compiler: "g++", ext: "cpp" },
    python: { compiler: "python3", ext: "py" },
    py: { compiler: "python3", ext: "py" },
    java: { compiler: "javac", ext: "java" },
    html: { compiler: "htmlhint", ext: "html" },
    css: { compiler: "stylelint", ext: "css" },
  },
};
