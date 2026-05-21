const https = require('https');

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return defaultValue;
};

const getAllowedGoogleClientIds = () => {
  const fromList = (process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const single = process.env.GOOGLE_CLIENT_ID?.trim();
  if (single && !fromList.includes(single)) fromList.push(single);
  return fromList;
};

const httpsGetJson = (url) =>
  new Promise((resolve, reject) => {
    const rejectUnauthorized = toBool(process.env.GOOGLE_TLS_REJECT_UNAUTHORIZED, true);

    https
      .get(url, { rejectUnauthorized }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (_) {
            parsed = { raw: data };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve(parsed);
          }
          const message =
            parsed?.error_description ||
            parsed?.error ||
            `Google token verify failed (HTTP ${res.statusCode})`;
          const err = new Error(message);
          err.statusCode = res.statusCode;
          err.response = parsed;
          return reject(err);
        });
      })
      .on('error', reject);
  });

/**
 * Verify Google ID token (from mobile/web Google Sign-In).
 * @see https://developers.google.com/identity/sign-in/web/backend-auth
 */
const verifyGoogleIdToken = async (idToken) => {
  const token = String(idToken || '').trim();
  if (!token) {
    const err = new Error('idToken is required');
    err.code = 'GOOGLE_TOKEN_MISSING';
    throw err;
  }

  const payload = await httpsGetJson(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
  );

  const allowedAudiences = getAllowedGoogleClientIds();
  if (allowedAudiences.length && !allowedAudiences.includes(payload.aud)) {
    const err = new Error('Invalid Google token audience');
    err.code = 'GOOGLE_AUDIENCE_MISMATCH';
    throw err;
  }

  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === 'true' ||
    payload.email_verified === '1';

  if (!emailVerified) {
    const err = new Error('Google email is not verified');
    err.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
    throw err;
  }

  if (!payload.email || !payload.sub) {
    const err = new Error('Invalid Google token payload');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }

  const expSec = Number(payload.exp);
  if (expSec && expSec * 1000 < Date.now()) {
    const err = new Error('Google token has expired');
    err.code = 'GOOGLE_TOKEN_EXPIRED';
    throw err;
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name ? String(payload.name).trim() : '',
    picture: payload.picture ? String(payload.picture).trim() : '',
    audience: payload.aud || '',
  };
};

module.exports = { verifyGoogleIdToken, getAllowedGoogleClientIds };
