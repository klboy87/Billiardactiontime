import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { activityPayload, dayDetroit } from '../src/activity.js';

test('activity log tolerates bad lines and groups by Detroit day', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'act-')), 'log.jsonl');
  fs.writeFileSync(f, [
    '{"time":"2026-11-12T03:30:00Z","routine":"r","type":"article","summary":"a","links":[],"status":"ok"}',
    'not json',
    '{"time":"2026-11-12T18:00:00Z","routine":"r","type":"suggestion","summary":"s","links":["https://x.com"],"status":"ok"}',
    '{"time":"2026-11-12T19:00:00Z","routine":"r","type":"error","summary":"e","links":[],"status":"failed"}',
  ].join('\n'));
  const p = activityPayload(f);
  assert.equal(p.total, 3);
  assert.equal(dayDetroit('2026-11-12T03:30:00Z'), '2026-11-11');
  assert.equal(p.days.length, 2);
  assert.equal(p.suggestions.length, 1);
  assert.equal(p.problems.length, 1);
});
