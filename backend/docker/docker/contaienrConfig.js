import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONTAINER_CONFIG = {
  containerName: "build_compiler_sandbox",
  containerSandboxPath: path.resolve(__dirname, "../sandbox"),
  containerResultboxPath: path.resolve(__dirname, "../resultbox"),

  languages: {
    c: {
      compiler: "gcc",
      ext: "c",
    },
    cpp: {
      compiler: "g++",
      ext: "cpp",
    },
  }

};