export const ROOM_CONFIG = {
  maxParticipants: 8,
  minParticipantsToStart: {
    "1/1": 2,
    default: 3,
  },
  roomStatus: {
    WAITING: "WAITING",
    STARTED: "STARTED",
    FINISHED: "FINISHED",
  },

  db: {
    host: process.env.DB_HOST || "db",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "game_user",
    password: process.env.DB_PASSWORD || "user_password_5678",
    database: process.env.DB_NAME || "rezero_game",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
  },

  valkey: {
    host: process.env.REDIS_HOST || "valkey",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    keys: {
      state: function (roomId) {
        return "room:" + roomId + ":state";
      },
      participants: function (roomId) {
        return "room:" + roomId + ":participants";
      },
      ready: function (roomId) {
        return "room:" + roomId + ":ready";
      },
    },
  },
};
