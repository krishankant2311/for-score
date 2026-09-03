/**
 * Read-only OneSignal auth check (lists recent notifications, does not send push).
 * node scripts/testOneSignalAuth.js
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { buildOneSignalAuthHeaders } = require('../modules/service/oneSignalService');

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return defaultValue;
};

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_REST_API_KEY;
const host = process.env.ONESIGNAL_API_HOST || 'onesignal.com';
const apiPath = process.env.ONESIGNAL_API_PATH || '/api/v1/notifications';

if (!appId || !apiKey) {
  console.error('FAIL: Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY in .env');
  process.exit(1);
}

const pathQuery = `${apiPath}?app_id=${encodeURIComponent(appId)}&limit=1&offset=0`;
const authHeader = buildOneSignalAuthHeaders(apiKey).Authorization;

const get = () =>
  new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: host,
          path: pathQuery,
          method: 'GET',
          rejectUnauthorized: toBool(process.env.ONESIGNAL_TLS_REJECT_UNAUTHORIZED, true),
          headers: { Authorization: authHeader, Accept: 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      )
      .on('error', reject);
  });

(async () => {
  console.log('OneSignal auth check (read-only GET, no push sent)');
  console.log('Host:', host);
  console.log('Path:', apiPath);
  console.log('App ID configured:', Boolean(appId));
  console.log('API key configured:', Boolean(apiKey));
  console.log('Auth scheme:', authHeader.split(' ')[0]);

  try {
    const r = await get();
    const ok = r.status >= 200 && r.status < 300;
    console.log(`\nHTTP ${r.status} ${ok ? 'OK — credentials valid' : 'FAIL'}`);
    if (!ok) {
      try {
        const parsed = JSON.parse(r.body);
        console.log(Array.isArray(parsed.errors) ? parsed.errors.join('; ') : r.body.slice(0, 200));
      } catch {
        console.log(r.body.slice(0, 200));
      }
    }
  } catch (e) {
    console.log('ERROR', e.message);
  }
})();
