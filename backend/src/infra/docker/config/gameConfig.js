import path from "path";

const rootDir = process.cwd();

export const GAME_CONTAINER_CONFIG = {
  containerName: "build_compiler_sandbox",
  baseImage: "gameroom-base-image",
  sandboxPath: path.resolve(rootDir, "../../../shared/fileShare/sandbox"),
  resultboxPath: path.resolve(rootDir, "../../../shared/fileShare/resultbox"),

  build: {
    contextPath: rootDir,
    dockerfilePath: path.resolve(
      rootDir,
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
