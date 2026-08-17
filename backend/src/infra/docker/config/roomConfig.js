import dotenv from "dotenv";

dotenv.config();

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

  valkey: {
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
