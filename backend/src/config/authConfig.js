import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || "default_jwt_secret",
  jwtExpiresIn: "1h",
  tokenRedisTTL: 3600,
  saltRounds: 10,
};