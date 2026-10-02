import fs from 'node:fs';

export function loadEnvFile(file = '.env') {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file: fine */ }
}

export function getConfig(env = process.env) {
  const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
  let fieldMap = {};
  if (env.FIELD_MAP) {
    try { fieldMap = JSON.parse(env.FIELD_MAP); } catch { throw new Error('FIELD_MAP is not valid JSON'); }
  }
  return {
    port: Number(env.PORT || 3000),
    dbPath: env.DB_PATH || './data/bat.db',
    publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
    adminToken: env.ADMIN_TOKEN || '',
    webhookSecret: env.WEBHOOK_SECRET || '',
    source: {
      name: env.SOURCE_NAME || 'source',
      url: env.SOURCE_URL || '',
      format: (env.SOURCE_FORMAT || 'json').toLowerCase(),
      token: env.SOURCE_TOKEN || '',
      authHeader: env.SOURCE_AUTH_HEADER || '',
      mode: (env.SOURCE_MODE || 'snapshot').toLowerCase(),
      itemsPath: env.SOURCE_ITEMS_PATH || '',
      pageParam: env.SOURCE_PAGE_PARAM || '',
      pageSize: Number(env.SOURCE_PAGE_SIZE || 500),
      verified: bool(env.SOURCE_VERIFIED, true),
      fieldMap
    },
    syncIntervalMinutes: Number(env.SYNC_INTERVAL_MINUTES ?? 60),
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    scanModel: env.SCAN_MODEL || 'claude-sonnet-5',
    geocoder: (env.GEOCODER || 'census').toLowerCase(),
    geocodePerRun: Number(env.GEOCODE_PER_RUN || 300),
    placesFile: env.PLACES_FILE || '',
    // Google AdSense publisher id ("ca-pub-1234567890123456"). Ads stay off until this is set.
    adsenseClient: /^ca-pub-\d{10,20}$/.test((env.ADSENSE_CLIENT || '').trim()) ? env.ADSENSE_CLIENT.trim() : ''
  };
}
