import * as service from '../services/notificationService.js';
import * as validate from '../validators/notificationValidators.js';
import * as push from '../services/pushService.js';
import * as pushValidate from '../validators/pushValidators.js';
import { AppError } from '../utils/AppError.js';
export async function list(req, res) { res.json(await service.list(validate.list(req.query), req.user)); }
export async function unread(req, res) { validate.empty(req.query); res.json(await service.unread(req.user)); }
export async function mark(req, res) { validate.empty(req.query); res.json(await service.mark(validate.id(req.params.id), validate.read(req.body), req.user)); }
export function pushConfig(req, res) { pushValidate.empty(req.query); res.json(push.pushConfiguration()); }
export async function subscribe(req, res) {
	pushValidate.empty(req.query);
	if (!await push.saveSubscription(req.user._id, pushValidate.subscription(req.body))) throw new AppError(503, 'Phone notifications are not configured on this server.');
	res.status(204).end();
}
export async function unsubscribe(req, res) {
	pushValidate.empty(req.query);
	await push.removeSubscription(req.user._id, pushValidate.endpoint(req.body));
	res.status(204).end();
}
