import * as service from '../services/progressService.js';
import * as validate from '../validators/progressValidators.js';
export async function history(req, res) { res.json(await service.history(validate.id(req.params.memberId), validate.list(req.query), req.user)); }
export async function create(req, res) { res.status(201).json({ progress: await service.save(validate.id(req.params.memberId), null, validate.entry(req.body), req.user) }); }
export async function update(req, res) { res.json({ progress: await service.save(validate.id(req.params.memberId), validate.id(req.params.id), validate.entry(req.body, true), req.user) }); }
