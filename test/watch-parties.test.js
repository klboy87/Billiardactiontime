import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, addWatchParty, listWatchParties, setWatchPartyStatus } from '../src/db.js';
import { cleanWatchParty, watchPartyOpen, mosconiPage } from '../src/mosconi.js';

test('Mosconi watch parties: validated, only approved ones are listed, form closes Dec 1', () => {
  assert.match(cleanWatchParty({ hall: 'X', city: '', state: 'FL', days: ['fri'] }).error, /city/);
  assert.match(cleanWatchParty({ hall: 'X', city: 'Tampa', state: 'FL', days: [] }).error, /day/);
  assert.match(cleanWatchParty({ hall: 'X', city: 'Tampa', state: 'FL', days: ['fri'], link: 'javascript:alert(1)' }).error, /link/);
  const ok = cleanWatchParty({ hall: '  Rack  Room ', city: 'Tampa', state: 'FL', days: ['sat', 'fri', 'bogus'], link: 'rackroom.com', email: 'A@B.CO', subscribe: true });
  assert.deepEqual(ok.value, { hall: 'Rack Room', city: 'Tampa', state: 'FL', days: 'Fri Nov 27, Sat Nov 28', link: 'https://rackroom.com/', email: 'a@b.co', subscribe: true });
  assert.equal(cleanWatchParty({ hall: 'A', city: 'B', state: 'C', days: 'mon', subscribe: true }).value.subscribe, false); // no email, no subscribe

  const db = openDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wp-')), 't.db'));
  const id1 = addWatchParty(db, ok.value);
  addWatchParty(db, { hall: 'Hidden <b>Hall</b>', city: 'Reno', state: 'NV', days: 'Sun Nov 29' });
  const cfg = { publicUrl: 'https://billiardactiontime.com' };
  let html = mosconiPage(cfg, db);
  assert.ok(!html.includes('Rack Room'));
  assert.match(html, /No watch parties listed yet/);
  assert.ok(setWatchPartyStatus(db, id1, 'approved'));
  assert.equal(setWatchPartyStatus(db, id1, 'bogus'), false);
  html = mosconiPage(cfg, db);
  assert.match(html, /Rack Room<\/a><\/b>, Tampa, FL/);
  assert.ok(!html.includes('Hidden'));
  assert.ok(!html.includes('a@b.co'));
  assert.equal(listWatchParties(db, 'approved').length, 1);
  assert.equal(listWatchParties(db).length, 2);
  assert.equal(watchPartyOpen(Date.parse('2026-12-01T04:59:00Z')), true);
  assert.equal(watchPartyOpen(Date.parse('2026-12-01T05:00:00Z')), false);
});
