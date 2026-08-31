export function toUserResponse(user) {
  const items = Array.isArray(user.items) ? user.items : [];
  const itemInventory = items.reduce(function (result, item) {
    result[item.itemKey] = Number(item.quantity || 0);
    return result;
  }, {});

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.display_name,
    gold: Number(user.gold ?? 0),
    ratingScore: Number(user.ratingScore ?? user.rating_score ?? 1000),
    itemInventory,
    titleData: user.titleData || {
      owned: [],
      equipped: null,
      stats: {
        totalWins: 0,
        consecutiveWins: 0,
        totalGames: 0,
        perfectGame: false,
        avgSpeed: 0,
        langWins: {},
      },
    },
  };
}

export function toSignupUserResponse(user) {
  const response = toUserResponse(user);

  return {
    id: response.id,
    username: response.username,
    displayName: response.displayName,
  };
}
