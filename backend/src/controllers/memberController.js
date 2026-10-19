import * as service from '../services/memberService.js';
import * as validation from '../validators/memberValidators.js';
import { validateRegistration } from '../validators/authValidators.js';
import { createUser } from '../services/authService.js';
export async function list(req, res) { res.json(await service.listMembers(validation.listQuery(req.query))); }
export async function detail(req, res) { res.json(await service.memberDetail(validation.memberId(req.params.id))); }
export async function create(req, res) {
  const user = await createUser(validateRegistration(req.body));
  res.status(201).json(await service.memberDetail(String(user._id)));
}
export async function update(req, res) { res.json({ member: await service.updateAccount(validation.memberId(req.params.id), validation.accountUpdate(req.body)) }); }
export async function profile(req, res) { res.json(await service.updateMemberProfile(validation.memberId(req.params.id), validation.memberProfile(req.body))); }
export async function archive(req, res) { res.json({ member: await service.archiveMember(validation.memberId(req.params.id)) }); }
export async function restore(req, res) { res.json({ member: await service.restoreMember(validation.memberId(req.params.id)) }); }
export async function trainers(_req, res) { res.json({ trainers: (await service.trainerOptions()).map(user => ({ id: String(user._id), name: user.name, email: user.email })) }); }
