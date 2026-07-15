function sendSuccess(res, data, status = 200) {
  // 성공 응답은 frontend/backend-handoff.md에 정리된 형식을 확인 후 작성하시면 됩니다.
  return res.status(status).json(data);
}

function sendError(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;

  return res.status(status).json({ error });
}

module.exports = {
  sendSuccess,
  sendError,
};
