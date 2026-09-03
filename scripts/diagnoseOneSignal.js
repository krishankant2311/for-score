/**
 * Diagnose OneSignal setup — tries POST auth without delivering to real users.
 * node scripts/diagnoseOneSignal.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const {
  postJsonWithFallback,
  defaultDeliveryTargets,
  isOneSignalDeliveryOk,
} = require('../modules/service/oneSignalService');

const appId = process.env.ONESIGNAL_APP_ID;
const apiKey = process.env.ONESIGNAL_REST_API_KEY;

(async () => {
  console.log('=== OneSignal diagnosis ===\n');
  if (!appId || !apiKey) {
    console.log('FAIL: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing in .env');
    process.exit(1);
  }

  console.log('App ID configured: yes');
  console.log('API key configured: yes');
  console.log('Key type:', /^os_v2_app_/i.test(String(apiKey).trim()) ? 'v2 (os_v2_app_)' : 'legacy/other');
  console.log('Endpoints to try:', defaultDeliveryTargets(apiKey).map((t) => t.label).join(' → '));
  console.log('');

  // Fake subscription id — auth passes if we get invalid id error, not 401/403
  const body = {
    app_id: appId,
    target_channel: 'push',
    headings: { en: 'Auth probe' },
    contents: { en: 'Auth probe' },
    include_subscription_ids: ['00000000-0000-0000-0000-000000000000'],
  };

  try {
    const resp = await postJsonWithFallback(apiKey, body);
    console.log('POST auth: OK (unexpected success on fake id)');
    console.log('Endpoint:', resp._deliveryEndpoint);
    console.log('Response id:', resp.id || '(none)');
  } catch (err) {
    const status = err.statusCode || 0;
    const msg = err.message || String(err);
    if (status === 401 || status === 403 || /access denied|valid api key/i.test(msg)) {
      console.log('POST auth: FAIL — key rejected by OneSignal');
      console.log('Error:', msg);
      console.log('');
      console.log('Fix checklist:');
      console.log('  1. OneSignal → Settings → Keys & IDs → your key');
      console.log('  2. Remove IP allowlist OR add this machine/server IP (403 often = IP blocked)');
      console.log('  3. Confirm key is App API Key for app', appId);
      console.log('  4. Do NOT paste Key ID column — use full os_v2_app_ secret');
      console.log('  5. Update live server .env + pm2 restart server --update-env');
      console.log('  6. Restart local npm run dev after .env change');
      process.exit(1);
    }
    if (/invalid.*subscription|invalid_player|not subscribed|subscription_id format/i.test(msg)) {
      console.log('POST auth: OK — OneSignal accepted the API key');
      console.log('(Got expected invalid-subscription response for probe id)');
      console.log('');
      console.log('Notifications should work from this machine once you send to real users.');
      process.exit(0);
    }
    console.log('POST auth: unclear —', msg);
    process.exit(1);
  }
})();
