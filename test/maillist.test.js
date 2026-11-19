import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, addSubscriber } from '../src/db.js';
import { makeListLogger, TAG } from '../src/maillist.js';

test('logs the subscriber list once per day inside the morning window', () => {
  const db = openDb(':memory:');
  addSubscriber(db, 'a@example.com'); addSubscriber(db, 'b@example.com');
  const lines = []; const tick = makeListLogger(db, l => lines.push(l));
  assert.equal(tick(new Date('2026-11-20T11:00:00Z')), false);          // 6:00 AM EST: too early
  assert.equal(tick(new Date('2026-11-20T11:28:00Z')), true);           // 6:28 AM EST
  assert.equal(tick(new Date('2026-11-20T11:30:00Z')), false);          // same day again
  assert.equal(lines.length, 1);
  const [tag, day, b64] = lines[0].split(' ');
  assert.equal(tag, TAG); assert.equal(day, '2026-11-20');
  assert.deepEqual(JSON.parse(Buffer.from(b64, 'base64').toString()), ['a@example.com', 'b@example.com']);
  assert.equal(tick(new Date('2026-11-21T11:26:00Z')), true);           // next day
});
