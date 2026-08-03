import express from 'express';

import {
  create,
  detail,
  join,
  leave,
  list,
  remove,
} from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.post('/rooms', create);
router.get('/rooms', list);
router.get('/rooms/:id', detail);
router.post('/rooms/:id/join', join);
router.post('/rooms/:id/leave', leave);
router.delete('/rooms/:id', remove);

export default router;
