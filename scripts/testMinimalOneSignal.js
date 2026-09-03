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
const query = `?app_id=${encodeURIComponent(appId)}&limit=1&offset=0`;
const auth = `Basic ${apiKey}`;

const get = () =>
  new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: 'onesignal.com',
          path: `/api/v1/notifications${query}`,
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

(async () => {
  const r = await get();
  console.log('status', r.status, r.data.slice(0, 120));
})();
