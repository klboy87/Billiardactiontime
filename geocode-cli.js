import { loadEnvFile, getConfig } from './config.js';
import { openDb } from './db.js';
import { geocodePending } from './geocode.js';

loadEnvFile();
const cfg = getConfig();
await geocodePending(openDb(cfg.dbPath), cfg, { log: console.log });
