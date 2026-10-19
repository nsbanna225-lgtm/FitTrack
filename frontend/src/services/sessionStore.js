import { roles } from '../utils/auth.js';

const validUser = user => roles.includes(user?.role)
  && typeof user.id === 'string' && !!user.id.trim()
  && typeof user.name === 'string' && !!user.name.trim();

export function createSessionStore({ now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let snapshot = { user: null, token: null, expiresAt: 0, notice: '' };
  let timer;
  let generation = 0;
  const listeners = new Set();
  function publish(next) { snapshot = next; listeners.forEach((listener) => listener()); }
  function clear(notice = '') {
    generation++;
    cancel(timer);
    publish({ user: null, token: null, expiresAt: 0, notice });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    clear,
    setSession(data) {
      if (!validUser(data?.user) || typeof data?.accessToken !== 'string' || !data.accessToken.trim() || !Number.isFinite(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn * 1000 > 2147483647) {
        throw new Error('Invalid authentication response.');
      }
      cancel(timer);
      const currentGeneration = ++generation;
      publish({ user: data.user, token: data.accessToken, expiresAt: now() + data.expiresIn * 1000, notice: '' });
      timer = schedule(() => {
        if (generation === currentGeneration) clear('Your session expired. Please sign in again.');
      }, data.expiresIn * 1000);
    },
    updateUser(user, expectedToken) {
      if (expectedToken && snapshot.token === expectedToken && validUser(user) && user.id === snapshot.user?.id) publish({ ...snapshot, user });
    },
    expireIfCurrent(token) {
      if (token && snapshot.token === token) clear('Your session ended. Please sign in again.');
    },
  };
}
export const sessionStore = createSessionStore();
