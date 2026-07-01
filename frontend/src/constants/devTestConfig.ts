/**
 * 로컬 테스트용 유저 초기 세팅.
 * 배포/멀티 연동 전에 `enabled: false` 로 되돌리세요.
 */
export const DEV_TEST_USER_LOADOUT = {
  enabled: true,
  gold: 50_000,
  items: {
    paint: 10,
    revealLength: 10,
    revealPrev: 10,
    lightning: 10,
    timeReduce: 10,
    scribble: 10,
    blankBreak: 10,
    buildCharge: 10,
  },
  /** 대기실 아이템 로드아웃에 전부 자동 선택 */
  autoSelectAllItemsInRoom: true,
} as const;
