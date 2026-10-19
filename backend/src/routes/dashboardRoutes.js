import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminDashboard } from '../controllers/dashboardController.js';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/admin', authenticate, authorize('admin'), adminDashboard);
export default router;
