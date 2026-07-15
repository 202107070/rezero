const { sendSuccess } = require('../../utils/responseHelper');

function getHealth(req, res) {
  return sendSuccess(res, {
    status: 'ok',
    service: 'rezero-backend',
  });
}

module.exports = { getHealth };
