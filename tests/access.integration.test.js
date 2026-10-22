import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.TEST_API_URL;
test('anonymous guest is college-scoped, read-only and has no database account', { skip: !base }, async () => {
  const colleges = await (await fetch(`${base}/guest/colleges`)).json();
  assert.ok(colleges.length);
  const response = await fetch(`${base}/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collegeId: colleges[0].id }) });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.user.id, null);
  const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/events?collegeId=${colleges[0].id}`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/events?collegeId=2147483647`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/requests`, { method: 'POST', headers, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/events`, { method: 'POST', headers, body: '{}' })).status, 403);
  assert.deepEqual(await (await fetch(`${base}/requests`, { headers })).json(), []);
  assert.equal((await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${session.token}tampered` } })).status, 401);
  assert.equal((await fetch(`${base}/auth/guest`, { method: 'POST', headers, body: '{"collegeId":-1}' })).status, 400);
});
