import { AppError } from '../utils/AppError.js';
export { listQuery, accountUpdate } from './memberValidators.js';
const invalid = message => { throw new AppError(400, message); };
export function trainerId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) invalid('Invalid trainer ID.');
  return value;
}
export function trainerProfile(body) {
  const allowed = ['specializations', 'experienceYears', 'bio', 'timezone', 'availability'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) invalid('Provide only supported profile fields.');
  const result = {};
  if ('specializations' in body) {
    if (!Array.isArray(body.specializations) || body.specializations.length > 10 || body.specializations.some(s => typeof s !== 'string' || !s.trim() || s.trim().length > 60)) invalid('Provide up to 10 specializations, each 1–60 characters.');
    result.specializations = [...new Map(body.specializations.map(s => [s.trim().toLowerCase(), s.trim()])).values()];
  }
  if ('experienceYears' in body) {
    if (!Number.isInteger(body.experienceYears) || body.experienceYears < 0 || body.experienceYears > 80) invalid('Experience must be a whole number from 0 to 80.');
    result.experienceYears = body.experienceYears;
  }
  if ('bio' in body) {
    if (typeof body.bio !== 'string' || body.bio.length > 2000) invalid('Biography must be text up to 2000 characters.');
    result.bio = body.bio.trim();
  }
  if ('timezone' in body) {
    if (typeof body.timezone !== 'string' || body.timezone.length > 100) invalid('Provide a valid time zone.');
    try { result.timezone = new Intl.DateTimeFormat('en', { timeZone: body.timezone }).resolvedOptions().timeZone; }
    catch { invalid('Provide a valid time zone, such as Asia/Kolkata.'); }
  }
  if ('availability' in body) {
    if (!Array.isArray(body.availability) || body.availability.length > 28) invalid('Provide up to 28 weekly time intervals.');
    const time = value => typeof value === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
    result.availability = body.availability.map(slot => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot) || Object.keys(slot).some(key => !['day','start','end'].includes(key)) || !Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6 || !time(slot.start) || !time(slot.end) || slot.start >= slot.end) invalid('Each interval needs a day (0–6) and increasing same-day times in HH:mm format.');
      return { day: slot.day, start: slot.start, end: slot.end };
    }).sort((a,b) => a.day - b.day || a.start.localeCompare(b.start));
    for (let i=1; i<result.availability.length; i++) {
      const previous = result.availability[i-1], current = result.availability[i];
      if (previous.day === current.day && previous.end > current.start) invalid('Availability intervals must not overlap.');
    }
  }
  return result;
}
