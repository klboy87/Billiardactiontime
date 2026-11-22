import test from 'node:test';
import assert from 'node:assert/strict';
import { liveTrackerHtml, mosconiLiveBannerHtml, mosconiFaq } from '../src/mosconi.js';

test('Mosconi live tracker: only on play days, only that day\'s matches', () => {
  const j = { liveScore: 'Europe 3 - USA 2', matches: [
    { date: '2026-11-27', match: 'Match 1', players: 'A vs B', score: '5-3', status: 'Final' },
    { date: '2026-11-28', match: 'Match 6', players: 'C vs <D>', score: '', status: 'Up next' }] };
  assert.equal(liveTrackerHtml('2026-11-26', j), '');
  assert.equal(liveTrackerHtml('2026-12-01', j), '');
  const day1 = liveTrackerHtml('2026-11-27', j);
  assert.match(day1, /Match 1/); assert.doesNotMatch(day1, /Match 6/); assert.match(day1, /Europe 3 - USA 2/);
  assert.match(liveTrackerHtml('2026-11-28', j), /C vs &lt;D&gt;/);
  assert.equal(liveTrackerHtml('2026-11-29', j), '');
  assert.equal(liveTrackerHtml('2026-11-27', {}), '');
  assert.match(mosconiLiveBannerHtml('2026-11-28', 'Europe 3 - USA 2'), /Mosconi Cup live: Europe 3 - USA 2/);
  assert.equal(mosconiLiveBannerHtml('2026-11-22', 'Europe 3 - USA 2'), '');
  assert.equal(mosconiLiveBannerHtml('2026-11-28', ''), '');
  assert.ok(mosconiFaq().some(([q, , h]) => /Why is it called/.test(q) && /straight-pool-14-1/.test(h)));
});
