import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import app from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
let server, base;
before(async () => {
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
function protections(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-powered-by'), null);
}
test('API protections cover success, missing routes and unauthenticated requests', async () => {
  for (const [path, status] of [['/api/health',200],['/api/missing',404],['/api/members',401]]) {
    const response = await fetch(base + path);
    assert.equal(response.status, status); protections(response);
  }
});
test('built frontend routes and PWA assets are served from the API origin', async t => {
  const frontendDist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  if (!existsSync(`${frontendDist}index.html`)) return t.skip('Build the frontend to test production static hosting.');
  const page = await fetch(base + '/member/notifications', { headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="root"/);
  for (const asset of ['/manifest.webmanifest', '/service-worker.js', '/fittrack-icon.svg']) {
    assert.equal((await fetch(base + asset)).status, 200, asset);
  }
});
test('request boundary rejects malformed, excessive and unsupported payloads safely', async () => {
  const cases = [
    ['application/json', '{secret', {}, 400],
    ['application/json', JSON.stringify({ data:'x'.repeat(103000) }), {}, 413],
    ['text/plain', '{"email":"private@example.test"}', {}, 415],
    ['application/json; charset=iso-8859-1', '{}', {}, 415],
    ['application/json', gzipSync('{}'), { 'Content-Encoding':'gzip' }, 415],
  ];
  for (const [type, body, headers, status] of cases) {
    const response = await fetch(base + '/api/auth/login', { method:'POST', headers:{'Content-Type':type,...headers}, body });
    assert.equal(response.status,status); protections(response);
    const result = await response.json();
    assert.equal(typeof result.message,'string');
    assert.doesNotMatch(JSON.stringify(result),/private@example|secret|stack|SyntaxError/);
  }
});
test('bodyless mutations and malformed protected paths retain authentication checks', async () => {
  const logout = await fetch(base + '/api/auth/logout', {method:'POST'});
  assert.equal(logout.status,401); protections(logout);
  const invalid = await fetch(base + '/api/members/%E0%A4%A');
  // Authentication runs before route parameter decoding on this router.
  assert.equal(invalid.status,401); protections(invalid);
});
test('database errors are sanitized and conflicts are not mislabeled as email errors', () => {
  for (const [error,status,message] of [
    [{code:11000,keyPattern:{email:1},keyValue:{email:'private'}},409,/email/],
    [{code:11000,keyPattern:{nameKey:1}},409,/conflicting record/],
    [{name:'CastError',value:'private'},400,/Invalid request/],
    [{name:'ValidationError',message:'private'},400,/Invalid request/],
    [new URIError('private'),400,/Invalid request path/],
  ]) {
    const res={status(value){assert.equal(value,status);return this;},json(value){assert.match(value.message,message);assert.doesNotMatch(JSON.stringify(value),/private/);}};
    errorHandler(error,{},res,()=>assert.fail('unexpected delegation'));
  }
});
test('errors after headers are sent delegate without a second response', () => {
  const error = new Error('private'); let delegated;
  errorHandler(error,{}, {headersSent:true}, value => { delegated=value; });
  assert.equal(delegated,error);
});

