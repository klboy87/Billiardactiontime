import test from 'node:test';
import assert from 'node:assert/strict';
import { thanksgivingLinkHtml, thanksgivingPromoOn, THANKSGIVING_PATH } from '../src/seo.js';
import { mosconiEmailBoxHtml } from '../src/mosconi.js';

test('Thanksgiving weekend promo link shows Nov 23-29 only', () => {
  assert.equal(thanksgivingPromoOn('2026-11-22'), false);
  assert.equal(thanksgivingPromoOn('2026-11-23'), true);
  assert.equal(thanksgivingPromoOn('2026-11-29'), true);
  assert.equal(thanksgivingPromoOn('2026-11-30'), false);
  assert.ok(thanksgivingLinkHtml('2026-11-25').includes(THANKSGIVING_PATH));
  assert.equal(thanksgivingLinkHtml('2026-11-30'), '');
});

test('Mosconi results-by-email box is tagged and hides after Nov 30', () => {
  const html = mosconiEmailBoxHtml(Date.UTC(2026, 10, 25));
  assert.ok(html.includes('data-source="mosconi"'));
  assert.equal(mosconiEmailBoxHtml(Date.UTC(2026, 11, 2)), '');
});
