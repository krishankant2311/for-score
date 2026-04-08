const https = require('https');

const ONESIGNAL_API_HOST = 'onesignal.com';
const ONESIGNAL_API_PATH = '/api/v1/notifications';

const postJson = (path, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        hostname: ONESIGNAL_API_HOST,
        path,
        method: 'POST',
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
  externalUserIds,
  sendToAll,
}) => {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    const err = new Error('OneSignal env missing: ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY');
    err.code = 'ONESIGNAL_ENV_MISSING';
    throw err;
  }

  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    data: data || {},
  };

  if (sendToAll) {
    payload.included_segments = ['Subscribed Users'];
  } else {
    payload.include_external_user_ids = (externalUserIds || []).map(String);
  }

  return await postJson(ONESIGNAL_API_PATH, payload, {
    Authorization: `Basic ${restApiKey}`,
  });
};

module.exports = { sendOneSignalNotification };

