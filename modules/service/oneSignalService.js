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

const collectInvalidIds = (errors) => {
  if (!errors) return [];
  if (Array.isArray(errors)) return errors.map(String);
  if (typeof errors === 'object') {
    const keys = [
      'invalid_player_ids',
      'invalid_subscription_ids',
      'invalid_aliases',
    ];
    const out = [];
    for (const key of keys) {
      const val = errors[key];
      if (Array.isArray(val)) out.push(...val.map(String));
    }
    return out;
  }
  return [];
};

/** True when OneSignal accepted the notification (has id, no invalid recipients). */
const isOneSignalDeliveryOk = (resp) => {
  if (!resp || typeof resp !== 'object') return false;
  if (resp.id) {
    const invalid = collectInvalidIds(resp.errors);
    return invalid.length === 0;
  }
  return false;
};

const getOneSignalDeliveryError = (resp) => {
  if (isOneSignalDeliveryOk(resp)) return null;
  const invalid = collectInvalidIds(resp?.errors);
  if (invalid.length) {
    return `OneSignal rejected recipient id(s): ${invalid.join(', ')}. Use subscription id from OneSignal dashboard (Audience → Subscriptions), and ensure Render ONESIGNAL_APP_ID matches the mobile app.`;
  }
  if (Array.isArray(resp?.errors) && resp.errors.length) {
    return resp.errors.join('; ');
  }
  if (resp?.errors && typeof resp.errors === 'string') {
    return resp.errors;
  }
  return 'OneSignal did not return a notification id — push was not sent.';
};

const buildBasePayload = ({ appId, title, message, data }) => ({
  app_id: appId,
  headings: { en: title },
  contents: { en: message },
  data: data || {},
  target_channel: 'push',
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

  const recipientIds = (playerIds || []).map(String).filter(Boolean);
  const authHeaders = { Authorization: `Basic ${restApiKey}` };

  if (sendToAll) {
    const resp = await postJson(
      ONESIGNAL_API_PATH,
      {
        ...buildBasePayload({ appId, title, message, data }),
        included_segments: ['Subscribed Users'],
      },
      authHeaders
    );
    resp._deliveryMethod = 'included_segments';
    return resp;
  }

  if (!recipientIds.length) {
    const err = new Error('At least one player/subscription id is required');
    err.code = 'ONESIGNAL_NO_RECIPIENTS';
    throw err;
  }

  // SDK 5+ → subscription id; older SDK → player id. Try both if first fails.
  const attempts = [
    {
      method: 'include_subscription_ids',
      body: {
        ...buildBasePayload({ appId, title, message, data }),
        include_subscription_ids: recipientIds,
      },
    },
    {
      method: 'include_player_ids',
      body: {
        app_id: appId,
        headings: { en: title },
        contents: { en: message },
        data: data || {},
        include_player_ids: recipientIds,
      },
    },
  ];

  let lastResp = null;
  for (const attempt of attempts) {
    const resp = await postJson(ONESIGNAL_API_PATH, attempt.body, authHeaders);
    resp._deliveryMethod = attempt.method;
    lastResp = resp;
    if (isOneSignalDeliveryOk(resp)) {
      return resp;
    }
  }

  return lastResp;
};

module.exports = {
  sendOneSignalNotification,
  isOneSignalDeliveryOk,
  getOneSignalDeliveryError,
};
