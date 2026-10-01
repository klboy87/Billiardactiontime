// One-time data fixes applied at startup. Each fix is idempotent (safe to run on every boot).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data-fixes');
const CANCEL_NOTE = 'MATCH CANCELED — no game.';

// Cabal vs Harrelson (Fulton, MS) was canceled: swap in the "Match Canceled" flyer and flag it.
function cabalHarrelsonCanceled(db, log) {
  const file = path.join(DIR, 'cabal-harrelson-canceled.jpg');
  if (!fs.existsSync(file)) return;
  const flyer = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
  const rows = db.prepare(`SELECT id, notes, flyer_data FROM money_matches
    WHERE lower(player1) LIKE '%cabal%' AND lower(player2) LIKE '%harrelson%' AND lower(city)='fulton'`).all();
  for (const r of rows) {
    if (r.flyer_data === flyer && /^match canceled/i.test(r.notes || '')) continue;
    const notes = /^match canceled/i.test(r.notes || '') ? r.notes : [CANCEL_NOTE, r.notes].filter(Boolean).join(' ').slice(0, 600);
    db.prepare(`UPDATE money_matches SET flyer_data=?, notes=?, updated_at=datetime('now') WHERE id=?`).run(flyer, notes, r.id);
    log(`data fix: money match ${r.id} marked canceled with new flyer`);
  }
}

export function applyDataFixes(db, log = console.log) {
  for (const fix of [cabalHarrelsonCanceled]) {
    try { fix(db, log); } catch (e) { log(`data fix ${fix.name} failed: ${e.message}`); }
  }
}
