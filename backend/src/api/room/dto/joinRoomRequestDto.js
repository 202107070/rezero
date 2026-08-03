import { AppError } from '../../../utils/appError.js';

const CHARACTERS = new Set(['char1', 'char2', 'char3', 'char4']);

function invalidJoinRequest(message) {
  return new AppError(400, 'INVALID_ROOM_JOIN_REQUEST', message);
}

export function parseJoinRoomRequest(body = {}) {
  const password = typeof body.password === 'string' ? body.password : '';
  const language = typeof body.language === 'string'
    ? body.language.trim()
    : '';
  const character = typeof body.character === 'string'
    ? body.character.trim()
    : '';

  if (password.length > 64) {
    throw invalidJoinRequest('방 비밀번호는 64자 이하로 입력해 주세요.');
  }

  if (language.length > 16) {
    throw invalidJoinRequest('언어 정보는 16자 이하로 입력해 주세요.');
  }

  if (character && !CHARACTERS.has(character)) {
    throw invalidJoinRequest('캐릭터는 char1부터 char4까지 선택할 수 있습니다.');
  }

  return {
    password,
    language: language || null,
    character: character || null,
  };
}

export function parseRoomId(value) {
  const roomId = Number(value);

  if (!Number.isInteger(roomId) || roomId < 1) {
    throw invalidJoinRequest('올바른 방 ID가 필요합니다.');
  }

  return roomId;
}
