import { loadEnvFile, getConfig } from './src/config.js';
import { openDb } from './src/db.js';
import { createApp } from './src/app.js';

loadEnvFile();
const cfg = getConfig();
if (!cfg.adminToken || cfg.adminToken.startsWith('change-me')) console.warn('Warning: set a real ADMIN_TOKEN in .env before going live.');
const db = openDb(cfg.dbPath);
const server = createApp(db, cfg, { log: m => console.log(new Date().toISOString(), m) });

server.listen(cfg.port, () => console.log(`Billiard Action Time running at ${cfg.publicUrl} (port ${cfg.port})`));

if (cfg.source.url && cfg.syncIntervalMinutes > 0) {
  const tick = () => server.syncNow().catch(e => console.error('sync error', e));
  setTimeout(tick, 5000);
  setInterval(tick, cfg.syncIntervalMinutes * 60_000).unref();
  console.log(`Syncing "${cfg.source.name}" every ${cfg.syncIntervalMinutes} minutes`);
} else {
  console.log('Automatic sync is off (set SOURCE_URL and SYNC_INTERVAL_MINUTES to turn it on)');
}
if (cfg.anthropicKey) console.log('Flyer reading is ON (ANTHROPIC_API_KEY is set)');
else console.log('Flyer reading is OFF -- set ANTHROPIC_API_KEY in .env to turn it on');
