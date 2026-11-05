import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSignupConflict } from '../src/api/user/signupConflict.js';
test('DB duplicate races map to nickname/username 409 without masking other DB failures', async () => {
  for (const [nickname, username, code] of [[true, false, 'DISPLAY_NAME_ALREADY_EXISTS'], [false, true, 'USERNAME_ALREADY_EXISTS'], [false, false, 'SIGNUP_CONFLICT']]) {
    await assert.rejects(mapSignupConflict({ errno: 1062 }, {}, { isDisplayNameTaken: async () => nickname, isUsernameTaken: async () => username }), { status: 409, code });
  }
  const failure = new Error('unavailable');
  await assert.rejects(mapSignupConflict(failure, {}, {}), error => error === failure);
});
