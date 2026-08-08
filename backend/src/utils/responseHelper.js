export function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data);
}

export function sendError(res, status, code, message, details) {
  const error = { code: code, message: message };
  if (details !== undefined) {
    error.details = details;
  }

  return res.status(status).json({ error: error });
}
