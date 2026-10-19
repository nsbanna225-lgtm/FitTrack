import * as service from '../services/membershipService.js';
import * as validate from '../validators/membershipValidators.js';
export async function plans(req,res) { res.json(await service.listPlans(validate.listQuery(req.query,true))); }
export async function createPlan(req,res) { res.status(201).json({plan:await service.createPlan(validate.planFields(req.body,true))}); }
export async function updatePlan(req,res) { res.json({plan:await service.updatePlan(validate.id(req.params.id),validate.planFields(req.body))}); }
export async function list(req,res) { res.json(await service.listMemberships(validate.listQuery(req.query))); }
export async function detail(req,res) { res.json(await service.memberMembership(validate.id(req.params.id))); }
export async function mine(req,res) { res.json(await service.memberMembership(String(req.user._id))); }
export async function enroll(req,res) { res.status(201).json(await service.enroll(validate.id(req.params.id),validate.enrollment(req.body),req.user._id)); }
export async function renew(req,res) { res.json(await service.renew(validate.id(req.params.id),validate.renewal(req.body),req.user._id)); }
