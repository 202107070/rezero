import { sendSuccess } from "#utils/responseHelper.js";

export function getHealth(req, res) {
  return sendSuccess(res, {
    status: "ok",
    service: "rezero-backend",
  });
}
