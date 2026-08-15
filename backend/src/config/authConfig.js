import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  return "default_jwt_secret";
}

export const authConfig = {
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: "1h",
  tokenRedisTTL: 3600,
  saltRounds: 10,
};
