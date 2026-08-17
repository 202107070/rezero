import jwt from "jsonwebtoken";

export const authMiddleware = {
  authenticateUser: function (req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || typeof authHeader !== "string") {
        return res.status(401).json({
          success: false,
          message: "Authorization header is missing.",
        });
      }

      let token = "";
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else {
        token = authHeader;
      }

      if (!token || token.trim().length === 0) {
        return res.status(401).json({
          success: false,
          message: "Authentication token is missing.",
        });
      }

      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
      const decodedPayload = jwt.verify(token, jwtSecret);

      req.user = decodedPayload;
      next();
    } catch (error) {
      console.error(
        "[AuthMiddleware] Token verification failed:",
        error.message,
      );
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token: " + error.message,
      });
    }
  },
};
