import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function getNodeEnv() {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  return "development";
}

function getHost() {
  if (process.env.HOST) {
    return process.env.HOST;
  }
  return "0.0.0.0";
}

function getPort() {
  if (process.env.PORT) {
    return Number(process.env.PORT);
  }
  return 8080;
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  return "";
}

function getJwtExpiresIn() {
  if (process.env.JWT_EXPIRES_IN) {
    return process.env.JWT_EXPIRES_IN;
  }
  return "1h";
}

export const env = {
  nodeEnv: getNodeEnv(),
  host: getHost(),
  port: getPort(),
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: getJwtExpiresIn(),
};
