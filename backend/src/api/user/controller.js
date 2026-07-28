import { parseLoginRequest } from './dto/loginRequestDto.js';
import { parseSignupRequest } from './dto/signupRequestDto.js';
import { getCurrentUser, loginUser, signupUser } from './service.js';
import { sendSuccess } from '../../utils/responseHelper.js';

export async function signup(req, res, next) {
  try {
    const input = parseSignupRequest(req.body);
    const result = await signupUser(input);
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const input = parseLoginRequest(req.body);
    const result = await loginUser(input);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    return sendSuccess(res, user);
  } catch (error) {
    return next(error);
  }
}
