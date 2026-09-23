export const SOCKET_EVENTS = {
  JOIN_ROOM: "join_room",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  CHAT_ERROR: "chat_error",
  TOGGLE_READY: "toggle_ready",
  READY_CHANGED: "ready_changed",
  REQUEST_GAME_START: "request_game_start",
  GAME_START_NOTICE: "game_start_notice",
  GAME_STARTED: "game_started",

  SUBMIT_CODE: "submit_code",
  USE_ITEM: "use_item",
  REQUEST_NEXT_QUESTION: "request_next_question",

  EXEC_RESULT: "exec_result",
  GAME_STATE_UPDATE: "game_state_update",
  ITEM_USED: "item_used",
  NEXT_QUESTION_STARTED: "next_question_started",

  GAME_ENDED: "game_ended",
  USER_RECONNECTED: "user_reconnected",

  /** 로비 접속자 목록 */
  LOBBY_PRESENCE: "lobby_presence",
  /** 결과 화면 리뷰 초대 */
  REVIEW_INVITE: "review_invite",
  REVIEW_INVITE_RESPONSE: "review_invite_response",
  UPDATE_CHARACTER: "update_character",
  CHARACTER_CHANGED: "character_changed",
  FRIEND_REQUEST: "friend_request",
  FRIEND_REQUEST_RESULT: "friend_request_result",
  FRIEND_REMOVE: "friend_remove",
  USER_KICKED: "user_kicked",
  UPDATE_TITLE: "update_title",
  TITLE_CHANGED: "title_changed",
  ROOM_INVITE: "room_invite",
  ROOM_INVITE_RESPONSE: "room_invite_response",
  UPDATE_LOCATION: "update_location",
  USER_LOGOUT: "user_logout",
};
