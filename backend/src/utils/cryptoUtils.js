import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "#config/envConfig.js";

const PASSWORD_SALT_ROUNDS = 12;

function getJwtSecret() {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET 환경변수 확인 후 진행하시면 됩니다.");
  }

  return env.jwtSecret;
}

export function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/** @param {string|{id:string,username?:string,displayName?:string}} userOrId */
export function createAccessToken(userOrId) {
  if (typeof userOrId === "string") {
    return jwt.sign({ sub: userOrId }, getJwtSecret(), {
      expiresIn: env.jwtExpiresIn,
    });
  }

  const payload = {
    sub: userOrId.id,
    username: userOrId.username || undefined,
    displayName: userOrId.displayName || userOrId.username || undefined,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}
