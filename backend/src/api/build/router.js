import express from 'express';
import { toMatchStartResponse } from '../battle/dto/matchStartResponseDto.js';

export function createBuildRouter({ sessions, executions, authenticate }) {
  const router = express.Router();
  if (executions) router.post('/build/execute', authenticate, async (req, res, next) => {
    try { res.json(await executions.execute(req.body, req.user.id)); }
    catch (error) { next(error); }
  });
  router.post('/build/session/save', authenticate, async (req, res, next) => {
    try { res.json(await sessions.save(req.body, req.user.id)); }
    catch (error) { next(error); }
  });
  router.get('/build/session/:matchId', authenticate, async (req, res, next) => {
    try {
      const result = await sessions.load(req.params.matchId, req.user.id);
      res.json({ ...result, match: toMatchStartResponse(result.match) });
    } catch (error) { next(error); }
  });
  return router;
}
