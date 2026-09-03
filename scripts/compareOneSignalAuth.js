/**
 * Compare old vs new OneSignal auth/endpoints (read-only GET, no push sent).
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const toBool = (v, d = true) => {
  if (v === undefined || v === null || v === '') return d;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return d;
};

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = String(process.env.ONESIGNAL_REST_API_KEY || '').trim();

const get = ({ host, path: apiPath, auth }) =>
  new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: host,
          path: apiPath,
          rejectUnauthorized: toBool(process.env.ONESIGNAL_TLS_REJECT_UNAUTHORIZED, true),
          headers: { Authorization: auth, Accept: 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }
      )
      .on('error', reject);
  });

const query = `?app_id=${encodeURIComponent(appId)}&limit=1&offset=0`;

const combos = [
  {
    label: 'OLD (before fix): onesignal.com + /api/v1 + Basic',
    host: 'onesignal.com',
    path: `/api/v1/notifications${query}`,
    auth: `Basic ${apiKey}`,
  },
  {
    label: 'NEW (after fix): api.onesignal.com + /notifications + Key',
    host: 'api.onesignal.com',
    path: `/notifications${query}`,
    auth: `Key ${apiKey}`,
  },
  {
    label: 'Hybrid: api.onesignal.com + /notifications + Basic',
    host: 'api.onesignal.com',
    path: `/notifications${query}`,
    auth: `Basic ${apiKey}`,
  },
  {
    label: 'Hybrid: onesignal.com + /api/v1 + Key',
    host: 'onesignal.com',
    path: `/api/v1/notifications${query}`,
    auth: `Key ${apiKey}`,
  },
];

(async () => {
  if (!appId || !apiKey) {
    console.error('Missing ONESIGNAL env vars');
    process.exit(1);
  }
  console.log('App ID set:', Boolean(appId));
  console.log('Key type:', /^os_v2_app_/i.test(apiKey) ? 'v2 (os_v2_app_)' : 'legacy/other');
  console.log('');

  for (const c of combos) {
    try {
      const r = await get(c);
      let msg = '';
      try {
        const p = JSON.parse(r.data);
        msg = Array.isArray(p.errors) ? p.errors[0] : r.data.slice(0, 120);
      } catch {
        msg = r.data.slice(0, 120);
      }
      console.log(`${c.label}`);
      console.log(`  HTTP ${r.status} — ${r.status < 300 ? 'OK' : msg}`);
      console.log('');
    } catch (e) {
      console.log(`${c.label}`);
      console.log(`  ERROR — ${e.message}`);
      console.log('');
    }
  }
})();
