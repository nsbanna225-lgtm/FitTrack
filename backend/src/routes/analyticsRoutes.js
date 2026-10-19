import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { analyticsQuery } from '../validators/analyticsValidators.js';
import { analytics } from '../services/analyticsService.js';
const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try { const now = new Date(); res.json(await analytics(analyticsQuery(req.query, now), now)); }
  catch (error) { next(error); }
});
export default router;
