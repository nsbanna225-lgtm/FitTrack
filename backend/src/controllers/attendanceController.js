import * as service from '../services/attendanceService.js';
import * as validate from '../validators/attendanceValidators.js';
export async function checkIn(req, res) { res.status(201).json({ attendance: await service.checkIn(validate.checkIn(req.body, req.user.role), req.user) }); }
export async function history(req, res) { res.json(await service.history(validate.list(req.query, req.user.role), req.user)); }
export async function report(req, res) { res.json(await service.report(validate.list(req.query, req.user.role))); }
