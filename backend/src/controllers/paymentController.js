import * as service from '../services/paymentService.js';
import * as validate from '../validators/paymentValidators.js';
import { id } from '../validators/membershipValidators.js';
export async function create(req, res) { res.json({ payment: await service.create(validate.create(req.body, req.user.role), req.user) }); }
export async function list(req, res) { res.json(await service.list(validate.list(req.query, req.user.role), req.user)); }
export async function simulate(req, res) { res.json({ payment: await service.transition(id(req.params.id), validate.transition(req.body), req.user) }); }
export async function retry(req, res) { res.json({ payment: await service.transition(id(req.params.id), validate.transition(req.body, true), req.user, true) }); }
