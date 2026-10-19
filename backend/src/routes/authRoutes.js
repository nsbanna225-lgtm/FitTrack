import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authLimiter, loginLimiter, resetLimiter } from '../middleware/authRateLimit.js';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(authLimiter);
router.get('/registration-options', controller.registrationOptions);
router.post('/register', controller.register);
router.post('/login', loginLimiter, controller.login);
router.post('/forgot-password', resetLimiter, controller.forgotPassword);
router.post('/reset-password', resetLimiter, controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, controller.updateProfile);
router.post('/logout', authenticate, controller.logout);
router.post('/change-password', authenticate, loginLimiter, controller.changePassword);
router.post('/staff', authenticate, authorize('admin'), controller.createStaff);
export default router;
