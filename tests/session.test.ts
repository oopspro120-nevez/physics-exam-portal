import test from 'node:test';
import assert from 'node:assert/strict';
import { activityAge, IDLE_TIMEOUT_MS, sessionCookieOptions } from '../lib/session';
test('Sleep duration counts toward idle time; passive polling has no activity', () => {
  assert.equal(activityAge(null, Date.now()), null);
  assert.equal(activityAge(1000, 1000 + 31 * 60000), IDLE_TIMEOUT_MS);
  assert.equal(activityAge(1000, 31000), 30000);
});
test('Auth cookies are session-only and sign-out still deletes them', () => {
  assert.deepEqual(
    sessionCookieOptions({ path: '/', maxAge: 31536000, expires: new Date(), httpOnly: true }),
    { path: '/', httpOnly: true },
  );
  assert.deepEqual(sessionCookieOptions({ path: '/', maxAge: 0, expires: new Date(0) }), {
    path: '/',
    maxAge: 0,
  });
});
