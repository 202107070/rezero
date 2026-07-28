import express from 'express';

import { getMe, login, signup } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.get('/users/me', authenticate, getMe);

export default router;
