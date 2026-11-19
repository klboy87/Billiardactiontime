import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, addMosconiPick, mosconiPickStats } from '../src/db.js';
import { pickBarHtml, picksOpen, PICKS_MIN_FOR_BAR } from '../src/mosconi.js';

test('Mosconi picks: one per visitor, bar only after enough picks, closes at 1 PM ET Nov 27', () => {
  const db = openDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'picks-')), 't.db'));
  addMosconiPick(db, 'v1', 'europe', '11-7');
  addMosconiPick(db, 'v1', 'usa', '11-9');            // same visitor changes their pick
  addMosconiPick(db, 'v2', 'europe', null);
  assert.deepEqual(mosconiPickStats(db), { total: 2, europe: 1, usa: 1 });
  assert.equal(pickBarHtml(mosconiPickStats(db)), '');
  for (let i = 0; i < PICKS_MIN_FOR_BAR; i++) addMosconiPick(db, 'x' + i, i % 4 ? 'europe' : 'usa');
  const bar = pickBarHtml(mosconiPickStats(db));
  assert.match(bar, /\d+% pick Europe/);
  assert.match(bar, /22 picks/);
  assert.equal(picksOpen(Date.parse('2026-11-27T17:59:00Z')), true);
  assert.equal(picksOpen(Date.parse('2026-11-27T18:00:00Z')), false);
});
