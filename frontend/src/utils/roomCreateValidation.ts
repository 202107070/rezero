export type RoomCreateFieldKey =
  | 'playerMode'
  | 'roomTitle'
  | 'difficulty'
  | 'language'
  | 'gameMode'
  | 'problemCount'
  | 'roomPwd';

export const ROOM_CREATE_FIELD_LABELS: Record<RoomCreateFieldKey, string> = {
  playerMode: '플레이 인원(1/1 또는 1/N)',
  roomTitle: '방 제목',
  difficulty: '난이도',
  language: '언어',
  gameMode: '모드',
  problemCount: '문제 수',
  roomPwd: '비공개 비밀번호',
};

export interface RoomCreateFormState {
  playerMode: string;
  gameMode: string;
  roomTitle: string;
  difficulty: string;
  language: string;
  roomVisibility: 'public' | 'private';
  roomPwd: string;
  problemCount: string;
}

/** 위에서부터 입력 순서대로 검사해 첫 미충족 필드에 focus할 수 있게 함 */
export function getMissingRoomCreateFields(form: RoomCreateFormState): RoomCreateFieldKey[] {
  const missing: RoomCreateFieldKey[] = [];
  if (!form.playerMode) missing.push('playerMode');
  if (!form.roomTitle.trim()) missing.push('roomTitle');
  if (!form.difficulty) missing.push('difficulty');
  if (!form.language) missing.push('language');
  if (!form.gameMode) missing.push('gameMode');
  if (!form.problemCount) missing.push('problemCount');
  if (form.roomVisibility === 'private' && !form.roomPwd.trim()) missing.push('roomPwd');
  return missing;
}

export function formatMissingRoomCreateMessage(missing: RoomCreateFieldKey[]): string {
  if (missing.length === 0) return '';
  const labels = missing.map((key) => ROOM_CREATE_FIELD_LABELS[key]);
  if (labels.length === 1) return `${labels[0]}을(를) 입력해 주세요.`;
  return `다음 항목을 확인해 주세요: ${labels.join(', ')}`;
}
