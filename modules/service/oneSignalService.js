const https = require('https');

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return defaultValue;
};

/** os_v2_app_ / os_v2_org_ keys → Key scheme; legacy REST keys → Basic. */
const buildOneSignalAuthHeaders = (restApiKey, scheme = 'auto') => {
  const key = String(restApiKey || '').trim();
  if (!key) return {};
  if (scheme === 'basic') return { Authorization: `Basic ${key}` };
  if (scheme === 'key') return { Authorization: `Key ${key}` };
  if (/^os_v2_(app|org)_/i.test(key)) return { Authorization: `Key ${key}` };
  return { Authorization: `Basic ${key}` };
};

const defaultDeliveryTargets = (restApiKey) => {
  const key = String(restApiKey || '').trim();
  const isV2 = /^os_v2_(app|org)_/i.test(key);
  const targets = [];

  if (process.env.ONESIGNAL_API_HOST && process.env.ONESIGNAL_API_PATH) {
    targets.push({
      host: process.env.ONESIGNAL_API_HOST,
      path: process.env.ONESIGNAL_API_PATH,
      authScheme: isV2 ? 'key' : 'basic',
      label: 'env override',
    });
  }

  if (isV2) {
    targets.push({
      host: 'api.onesignal.com',
      path: '/notifications',
      authScheme: 'key',
      label: 'v2 api.onesignal.com Key',
    });
  }

  targets.push({
    host: 'onesignal.com',
    path: '/api/v1/notifications',
    authScheme: isV2 ? 'key' : 'basic',
    label: 'legacy onesignal.com',
  });

  if (isV2) {
    targets.push({
      host: 'onesignal.com',
      path: '/api/v1/notifications',
      authScheme: 'basic',
      label: 'legacy onesignal.com Basic',
    });
  }

  const seen = new Set();
  return targets.filter((t) => {
    const id = `${t.host}|${t.path}|${t.authScheme}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const postJson = ({ hostname, path, body, headers = {} }) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const rejectUnauthorized = toBool(process.env.ONESIGNAL_TLS_REJECT_UNAUTHORIZED, true);

    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        rejectUnauthorized,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
          Accept: 'application/json',
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
          if (statusCode >= 200 && statusCode < 300) {
            parsed._httpStatus = statusCode;
            return resolve(parsed);
          }
          const detail =
            (Array.isArray(parsed?.errors) && parsed.errors.join('; ')) ||
            parsed?.errors ||
            parsed?.error ||
            `OneSignal HTTP ${statusCode}`;
          const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
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

const postJsonWithFallback = async (restApiKey, body) => {
  const targets = defaultDeliveryTargets(restApiKey);
  let lastErr = null;

  for (const target of targets) {
    try {
      const resp = await postJson({
        hostname: target.host,
        path: target.path,
        body,
        headers: buildOneSignalAuthHeaders(restApiKey, target.authScheme),
      });
      resp._deliveryEndpoint = `${target.host}${target.path} (${target.label})`;
      return resp;
    } catch (err) {
      lastErr = err;
      if (err.statusCode === 401 || err.statusCode === 403) continue;
      throw err;
    }
  }

  const err = lastErr || new Error('OneSignal request failed for all configured endpoints');
  err.code = 'ONESIGNAL_AUTH_FAILED';
  throw err;
};

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

/** True when OneSignal accepted the notification (created id or positive recipient count). */
const isOneSignalDeliveryOk = (resp) => {
  if (!resp || typeof resp !== 'object') return false;
  if (resp.id) return true;
  const recipients = Number(resp.recipients);
  if (Number.isFinite(recipients) && recipients > 0) return true;
  return false;
};

const getOneSignalDeliveryError = (resp) => {
  if (isOneSignalDeliveryOk(resp)) return null;
  const invalid = collectInvalidIds(resp?.errors);
  if (invalid.length) {
    return `OneSignal rejected recipient id(s): ${invalid.join(', ')}. User must open the app and allow notifications so subscription id is saved via POST /api/user/profile/player-id.`;
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

  if (sendToAll) {
    const segments = [
      process.env.ONESIGNAL_BROADCAST_SEGMENT,
      'Subscribed Users',
      'All',
    ].filter(Boolean);
    const tried = [...new Set(segments)];
    let lastErr = null;

    for (const segment of tried) {
      try {
        const resp = await postJsonWithFallback(restApiKey, {
          ...buildBasePayload({ appId, title, message, data }),
          included_segments: [segment],
        });
        resp._deliveryMethod = `included_segments:${segment}`;
        return resp;
      } catch (err) {
        lastErr = err;
      }
    }

    const err = lastErr || new Error('OneSignal broadcast failed for all segments');
    err.code = 'ONESIGNAL_BROADCAST_FAILED';
    throw err;
  }

  if (!recipientIds.length) {
    const err = new Error('At least one player/subscription id is required');
    err.code = 'ONESIGNAL_NO_RECIPIENTS';
    throw err;
  }

  const tryDelivery = async (idsToTry) => {
    const resp = await postJsonWithFallback(restApiKey, {
      ...buildBasePayload({ appId, title, message, data }),
      include_subscription_ids: idsToTry,
    });
    resp._deliveryMethod = 'include_subscription_ids';
    return resp;
  };

  let idsToSend = [...recipientIds];
  let lastResp = await tryDelivery(idsToSend);
  const invalidFirst = collectInvalidIds(lastResp?.errors);
  if (!isOneSignalDeliveryOk(lastResp) && invalidFirst.length) {
    const invalidSet = new Set(invalidFirst.map(String));
    const filtered = idsToSend.filter((id) => !invalidSet.has(String(id)));
    if (filtered.length && filtered.length < idsToSend.length) {
      lastResp = await tryDelivery(filtered);
    }
  }

  return lastResp;
};

module.exports = {
  sendOneSignalNotification,
  isOneSignalDeliveryOk,
  getOneSignalDeliveryError,
  collectInvalidIds,
  buildOneSignalAuthHeaders,
  postJsonWithFallback,
  defaultDeliveryTargets,
};
