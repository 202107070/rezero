export class GameStartDto {
  constructor({
    roomId,
    canStart,
    reason,
    totalPlayers,
    nonHostPlayers,
    readyNonHostPlayers,
  }) {
    this.roomId = roomId;
    this.canStart = canStart;
    this.reason = reason;
    this.playerSummary = {
      totalPlayers: totalPlayers,
      nonHostPlayers: nonHostPlayers,
      readyNonHostPlayers: readyNonHostPlayers,
    };
  }

  toJSON() {
    return {
      roomId: this.roomId,
      canStart: this.canStart,
      reason: this.reason,
      playerSummary: this.playerSummary,
    };
  }
}
