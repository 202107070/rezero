import path from "path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(currentDirectory, "../../../..");
const projectRoot = path.resolve(backendDirectory, "..");
const sharedDirectory = path.resolve(
  backendDirectory,
  "../../../shared/fileShare",
);

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
