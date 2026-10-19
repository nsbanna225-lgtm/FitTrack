import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../src/services/sessionStore.js';
import { homeFor, safeReturnPath, passwordError, errorMessage } from '../src/utils/auth.js';

const member = { id: '1', name: 'Test Member', role: 'member' };
function controlledStore() {
  const timers = new Map();
  let id = 0;
  const store = createSessionStore({ now: () => 1000, schedule: (callback) => { timers.set(++id, callback); return id; }, cancel: (timer) => timers.delete(timer) });
  return { store, timers };
}
test('session expiry clears identity and notifies subscribers', () => {
  const { store, timers } = controlledStore();
  let changes = 0;
  store.subscribe(() => changes++);
  store.setSession({ user: member, accessToken: 'token', expiresIn: 900 });
  assert.equal(store.getSnapshot().expiresAt, 901000);
  [...timers.values()][0]();
  assert.equal(store.getSnapshot().token, null);
  assert.match(store.getSnapshot().notice, /expired/);
  assert.equal(changes, 2);
});
test('a stale unauthorized response cannot sign out a newer session', () => {
  const { store, timers } = controlledStore();
  store.setSession({ user: member, accessToken: 'old', expiresIn: 900 });
  store.setSession({ user: member, accessToken: 'new', expiresIn: 900 });
  assert.equal(timers.size, 1);
  store.expireIfCurrent('old');
  assert.equal(store.getSnapshot().token, 'new');
  store.expireIfCurrent('new');
  assert.equal(store.getSnapshot().user, null);
});
test('profile responses from old sessions cannot overwrite the active user', () => {
  const { store } = controlledStore();
  store.setSession({ user: member, accessToken: 'new', expiresIn: 900 });
  store.updateUser({ ...member, name: 'Stale' }, 'old');
  assert.equal(store.getSnapshot().user.name, member.name);
  store.updateUser({ ...member, name: 'Updated' }, 'new');
  assert.equal(store.getSnapshot().user.name, 'Updated');
});
test('invalid server sessions are rejected', () => {
  const { store } = controlledStore();
  for (const data of [{ user: { role: 'owner' }, accessToken: 'x', expiresIn: 900 }, { user: member, accessToken: '', expiresIn: 900 }, { user: member, accessToken: 'x', expiresIn: -1 }]) {
    assert.throws(() => store.setSession(data), /Invalid/);
  }
});
test('return paths are restricted to the signed-in role and cannot redirect externally', () => {
  assert.equal(safeReturnPath('/member/profile', 'member'), '/member/profile');
  for (const path of ['https://example.com', '//example.com', '/admin', '/member-other', '/member/../admin', '/member/%2e%2e/admin', '/member/\\example.com']) {
    assert.equal(safeReturnPath(path, 'member'), '/member');
  }
  assert.equal(homeFor('admin'), '/admin');
  assert.equal(homeFor('trainer'), '/trainer');
  assert.equal(homeFor('member'), '/member');
});
test('password checks match the server byte limits and error states are actionable', () => {
  assert.match(passwordError('short'), /12/);
  assert.match(passwordError('🔒'.repeat(19)), /72/);
  assert.equal(passwordError('Long-enough-password'), '');
  assert.match(errorMessage({}), /connection/);
  assert.match(errorMessage({ response: { status: 429 } }), /Too many/);
});

test('non-text, empty and excessive server errors always produce safe display text', () => {
  for (const message of [{nested:'error'},['error'],42,'','   ','x'.repeat(501)]) {
    assert.equal(errorMessage({response:{status:500,data:{message}}}), 'Something went wrong. Please try again.');
  }
  assert.equal(errorMessage({response:{status:400,data:{message:'Choose a valid date.'}}}), 'Choose a valid date.');
});

test('malformed identities and overflowing lifetimes are rejected before publishing a session', () => {
  const { store } = controlledStore();
  for (const user of [{role:'member'}, {...member,name:null}, {...member,name:'  '}, {...member,id:42}]) {
    assert.throws(() => store.setSession({user,accessToken:'token',expiresIn:900}), /Invalid/);
    assert.equal(store.getSnapshot().user,null);
  }
  assert.throws(() => store.setSession({user:member,accessToken:'token',expiresIn:2147484}), /Invalid/);
});

test('a queued expiry from an earlier session cannot clear a replacement session', () => {
  const {store,timers} = controlledStore();
  store.setSession({user:member,accessToken:'old',expiresIn:900});
  const oldExpiry = [...timers.values()][0];
  store.setSession({user:member,accessToken:'new',expiresIn:900});
  oldExpiry();
  assert.equal(store.getSnapshot().token,'new');
  [...timers.values()][0]();
  assert.equal(store.getSnapshot().token,null);
});

test('invalid or unrelated profile responses cannot replace the authenticated identity', () => {
  const {store} = controlledStore();
  store.setSession({user:member,accessToken:'token',expiresIn:900});
  for(const user of [{...member,name:null},{...member,id:'other'}]) {
    store.updateUser(user,'token');
    assert.deepEqual(store.getSnapshot().user,member);
  }
  store.updateUser({...member,name:'Updated',role:'trainer'},'token');
  assert.equal(store.getSnapshot().user.name,'Updated');
  assert.equal(store.getSnapshot().user.role,'trainer');
});
