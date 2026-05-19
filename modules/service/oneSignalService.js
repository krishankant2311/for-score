const https = require('https');

const ONESIGNAL_API_HOST = 'onesignal.com';
const ONESIGNAL_API_PATH = '/api/v1/notifications';

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return defaultValue;
};

const postJson = (path, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const rejectUnauthorized = toBool(process.env.ONESIGNAL_TLS_REJECT_UNAUTHORIZED, true);

    const req = https.request(
      {
        hostname: ONESIGNAL_API_HOST,
        path,
        method: 'POST',
        rejectUnauthorized,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (_) {
            parsed = { raw: data };
          }
          if (statusCode >= 200 && statusCode < 300) return resolve(parsed);
          const err = new Error(
            (parsed && (parsed.errors || parsed.error)) || `OneSignal HTTP ${statusCode}`
          );
          err.statusCode = statusCode;
          err.response = parsed;
          return reject(err);
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

const sendOneSignalNotification = async ({
  title,
  message,
  data,
  playerIds,
  sendToAll,
}) => {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    const err = new Error('OneSignal env missing: ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY');
    err.code = 'ONESIGNAL_ENV_MISSING';
    throw err;
  }

  const subscriptionIds = (playerIds || []).map(String).filter(Boolean);

  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    data: data || {},
    target_channel: 'push',
  };

  if (sendToAll) {
    payload.included_segments = ['Subscribed Users'];
  } else {
    // SDK 5+ uses subscription IDs (UUID), not legacy player_id
    payload.include_subscription_ids = subscriptionIds;
  }

  return await postJson(ONESIGNAL_API_PATH, payload, {
    Authorization: `Basic ${restApiKey}`,
  });
};

module.exports = { sendOneSignalNotification };

