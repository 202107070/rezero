import jwt from "jsonwebtoken";
import { authConfig } from "#config/authConfig.js";
import * as userModel from "../api/user/model.js";

export async function socketAuthMiddleware(socket, next) {
  let token;
  if (socket.handshake.auth && socket.handshake.auth.token) {
    token = socket.handshake.auth.token;
  } else if (
    socket.handshake.headers &&
    socket.handshake.headers.authorization
  ) {
    token = socket.handshake.headers.authorization;
  }

  if (!token) {
    return next(new Error("소켓 인증 실패: 토큰이 존재하지 않습니다."));
  }

  try {
    let actualToken;
    if (token.indexOf("Bearer ") === 0) {
      actualToken = token.split(" ")[1];
    } else {
      actualToken = token;
    }

    const decoded = jwt.verify(actualToken, authConfig.jwtSecret);
    const userId = decoded.id || decoded.sub;

    let username = decoded.username || "";
    let displayName = decoded.displayName || "";

    // 항상 DB에서 최신 닉네임을 우선 사용 (JWT에 username만 있는 경우 방지)
    try {
      const user = await userModel.findUserById(userId);
      if (user) {
        username = user.username || username || "";
        displayName = user.displayName || displayName || user.username || "";
      }
    } catch {
      // ignore DB lookup failure
    }

    socket.user = {
      id: userId,
      username: username || "",
      displayName: displayName || username || String(userId || "USER"),
    };

    next();
  } catch (err) {
    return next(
      new Error("소켓 인증 실패: 유효하지 않거나 만료된 토큰입니다."),
    );
  }
}
