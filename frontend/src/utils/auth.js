export const roles = ['admin', 'trainer', 'member'];
export const homeFor = (role) => roles.includes(role) ? `/${role}` : '/login';

export function safeReturnPath(path, role) {
  const home = homeFor(role);
  if (typeof path !== 'string' || path.includes('\\') || path.includes('%') || path.includes('..')) return home;
  return path === home || path.startsWith(`${home}/`) ? path : home;
}
export function passwordError(value) {
  if (value.length < 12) return 'Use at least 12 characters for your password.';
  if (new TextEncoder().encode(value).length > 72 || value.includes('\0')) return 'Use no more than 72 bytes and no null characters in your password.';
  return '';
}
export function errorMessage(error) {
  if (!error?.response) return 'We could not reach FitTrack. Check your connection and try again.';
  if (error.response.status === 429) return 'Too many attempts. Please wait before trying again.';
  const message = error.response.data?.message;
  return typeof message === 'string' && message.trim() && message.length <= 500
    ? message : 'Something went wrong. Please try again.';
}
