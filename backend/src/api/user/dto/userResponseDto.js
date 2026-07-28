export function toUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.display_name,
    gold: Number(user.gold ?? 0),
    ratingScore: Number(user.ratingScore ?? user.rating_score ?? 1000),
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
