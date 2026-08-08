import jwt from "jsonwebtoken";
import { authConfig } from "#config/authConfig.js";

export function socketAuthMiddleware(socket, next) {
  let token;
  if (socket.handshake.auth && socket.handshake.auth.token) {
    token = socket.handshake.auth.token;
  } else {
    if (socket.handshake.headers && socket.handshake.headers.authorization) {
      token = socket.handshake.headers.authorization;
    }
  }

  if (!token) {
    return next(new Error("소켓 인증 실패: 토큰이 누락되었습니다."));
  }

  try {
    let actualToken;
    if (token.startsWith("Bearer ")) {
      actualToken = token.split(" ")[1];
    } else {
      actualToken = token;
    }

    const decoded = jwt.verify(actualToken, authConfig.jwtSecret);

    socket.user = {
      id: decoded.id,
      username: decoded.username,
      displayName: decoded.displayName,
    };

    next();
  } catch (error) {
    return next(
      new Error("소켓 인증 실패: 유효하지 않거나 만료된 토큰입니다."),
    );
  }
}
