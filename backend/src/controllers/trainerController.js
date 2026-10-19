import * as service from '../services/trainerService.js';
import * as validation from '../validators/trainerValidators.js';
import { validateRegistration } from '../validators/authValidators.js';
import { createUser } from '../services/authService.js';
export async function list(req, res) { res.json(await service.listTrainers(validation.listQuery(req.query))); }
export async function detail(req, res) { res.json(await service.trainerDetail(validation.trainerId(req.params.id))); }
export async function create(req, res) {
  const user = await createUser({ ...validateRegistration(req.body), role: 'trainer' });
  res.status(201).json(await service.trainerDetail(String(user._id)));
}
export async function update(req, res) { res.json({ trainer: await service.updateAccount(validation.trainerId(req.params.id), validation.accountUpdate(req.body)) }); }
export async function profile(req, res) { res.json(await service.updateTrainerProfile(validation.trainerId(req.params.id), validation.trainerProfile(req.body))); }
export async function archive(req, res) { res.json({ trainer: await service.archiveTrainer(validation.trainerId(req.params.id)) }); }
export async function restore(req, res) { res.json({ trainer: await service.restoreTrainer(validation.trainerId(req.params.id)) }); }
export async function members(req, res) { res.json(await service.assignedMembers(validation.trainerId(req.params.id), validation.listQuery(req.query))); }
