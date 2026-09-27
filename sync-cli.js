import { loadEnvFile, getConfig } from './config.js';
import { openDb } from './db.js';
import { runSync } from './sync.js';
import { geocodePending } from './geocode.js';

loadEnvFile();
const cfg = getConfig();
const db = openDb(cfg.dbPath);
const r = await runSync(db, cfg, { log: console.log });
if (r.message) console.log(r.message);
if (r.status === 'ok') await geocodePending(db, cfg, { log: console.log });
process.exit(r.status === 'error' ? 1 : 0);
