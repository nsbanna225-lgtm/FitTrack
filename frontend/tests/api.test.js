import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/services/api.js';
import { authApi } from '../src/services/auth.js';
import { sessionStore } from '../src/services/sessionStore.js';

const originalAdapter = api.defaults.adapter;
const startSession = (token = 'test-token') => sessionStore.setSession({ user: { id: '1', name: 'Test Member', role: 'member' }, accessToken: token, expiresIn: 900 });
const ok = (config, data = {}) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const unauthorized = (config) => Promise.reject({ config, response: { status: 401, data: { message: 'Unauthorized' } } });
afterEach(() => { api.defaults.adapter = originalAdapter; sessionStore.clear(); });

test('protected requests carry the in-memory token; public login does not', async () => {
  startSession();
  const seen = [];
  api.defaults.adapter = async (config) => { seen.push(config.headers.Authorization); return ok(config); };
  await authApi.me();
  await authApi.login({ email: 'test@example.test', password: 'test-only-password' });
  assert.deepEqual(seen, ['Bearer test-token', undefined]);
});
test('an authenticated 401 clears the current session', async () => {
  startSession();
  api.defaults.adapter = unauthorized;
  await assert.rejects(authApi.me());
  assert.equal(sessionStore.getSnapshot().user, null);
});
test('login sends the selected role alongside credentials without an authorization header', async () => {
  for (const role of ['member', 'trainer', 'admin']) {
    const credentials = { email: 'test@example.test', password: 'test-only-password', role };
    api.defaults.adapter = async config => {
      assert.equal(config.url, '/auth/login');
      assert.deepEqual(JSON.parse(config.data), credentials);
      assert.equal(config.headers.Authorization, undefined);
      return ok(config);
    };
    await authApi.login(credentials);
  }
});
test('a wrong current password preserves a still-valid session', async () => {
  startSession();
  const calls = [];
  api.defaults.adapter = (config) => {
    calls.push(config.url);
    return config.url === '/auth/change-password' ? unauthorized(config) : Promise.resolve(ok(config));
  };
  await assert.rejects(authApi.changePassword({ currentPassword: 'wrong', newPassword: 'new-password-123' }));
  assert.deepEqual(calls, ['/auth/change-password', '/auth/me']);
  assert.equal(sessionStore.getSnapshot().token, 'test-token');
});
test('an invalid session during password change is cleared after verification', async () => {
  startSession();
  api.defaults.adapter = unauthorized;
  await assert.rejects(authApi.changePassword({ currentPassword: 'old', newPassword: 'new-password-123' }));
  assert.equal(sessionStore.getSnapshot().user, null);
});
test('a public login failure does not clear an unrelated session', async () => {
  startSession();
  api.defaults.adapter = unauthorized;
  await assert.rejects(authApi.login({ email: 'test@example.test', password: 'wrong' }));
  assert.equal(sessionStore.getSnapshot().token, 'test-token');
});


test('a delayed 401 from a previous login cannot sign out the replacement session', async () => {
  startSession('old');
  let rejectRequest, started;
  const ready = new Promise(resolve => { started = resolve; });
  api.defaults.adapter = config => new Promise((_resolve,reject) => {
    rejectRequest = () => reject({config,response:{status:401}});
    started();
  });
  const request = authApi.me();
  const rejected = assert.rejects(request);
  await ready;
  startSession('new');
  rejectRequest();
  await rejected;
  assert.equal(sessionStore.getSnapshot().token,'new');
});

test('server failures and cancelled requests preserve a valid login', async () => {
  startSession();
  api.defaults.adapter = config => Promise.reject({config,response:{status:500}});
  await assert.rejects(authApi.me());
  assert.equal(sessionStore.getSnapshot().token,'test-token');
  let reachedAdapter = false;
  api.defaults.adapter = async config => { reachedAdapter=true;return ok(config); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.get('/auth/me',{signal:controller.signal}));
  assert.equal(reachedAdapter,false);
  assert.equal(sessionStore.getSnapshot().token,'test-token');
});
