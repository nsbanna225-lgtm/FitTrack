import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import workoutRoutes from './routes/workoutRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import trainerRoutes from './routes/trainerRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiBoundary } from './middleware/apiBoundary.js';

const app = express();
const frontendDist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
app.disable('x-powered-by');
app.use('/api', apiBoundary);
app.use(express.json({ limit: '100kb', inflate: false }));
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api', notFound);
app.use(express.static(frontendDist));
app.get(/.*/, (req, res, next) => {
	if (req.get('accept')?.includes('text/html')) return res.sendFile(`${frontendDist}index.html`);
	next();
});
app.use(notFound);
app.use(errorHandler);

export default app;

