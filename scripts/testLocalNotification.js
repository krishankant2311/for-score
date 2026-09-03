/**
 * End-to-end local notification test (uses .env + optional local API).
 * node scripts/testLocalNotification.js
 */
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;

const postJson = (urlPath, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

async function testOneSignalDirect() {
  const { sendOneSignalNotification, isOneSignalDeliveryOk } = require('../modules/service/oneSignalService');
  console.log('\n=== 1) OneSignal direct (sendToAll segment) ===');
  try {
    const resp = await sendOneSignalNotification({
      title: 'Local test',
      message: 'Four Score local notification test',
      sendToAll: true,
      data: { source: 'testLocalNotification.js' },
    });
    const ok = isOneSignalDeliveryOk(resp);
    console.log('Delivery:', ok ? 'OK' : 'FAIL');
    console.log('OneSignal id:', resp?.id || '(none)');
    console.log('Recipients:', resp?.recipients ?? '(n/a)');
    if (resp?.errors) console.log('Errors:', resp.errors);
    return ok;
  } catch (err) {
    console.log('FAIL:', err.message);
    if (err.response) console.log('Response:', JSON.stringify(err.response).slice(0, 300));
    return false;
  }
}

async function testLocalApi() {
  console.log('\n=== 2) Local API flow (admin login → send-notification) ===');

  const health = await new Promise((resolve) => {
    http
      .get(`${BASE}/api/test`, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on('error', () => resolve(0));
  });
  if (health !== 200) {
    console.log(`SKIP: Local server not up on ${BASE} (run npm run dev)`);
    return null;
  }
  console.log('Server:', BASE, 'OK');

  const login = await postJson('/api/admin/login', {
    email: process.env.TEST_ADMIN_EMAIL || 'krishankant@jewarinternational.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
  });
  if (login.status !== 200 || !login.data?.success) {
    console.log('Admin login FAIL:', login.status, login.data?.message || login.data);
    return false;
  }
  const token = login.data?.result?.token || login.data?.token;
  if (!token) {
    console.log('Admin login: no token in response');
    return false;
  }
  console.log('Admin login: OK');

  const mongoose = require('mongoose');
  const User = require('../modules/model/userModel');
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });
  const user = await User.findOne({
    status: 'Active',
    oneSignalPlayerId: { $exists: true, $nin: [null, ''] },
  })
    .select('_id email oneSignalPlayerId')
    .lean();
  await mongoose.disconnect();

  if (!user) {
    console.log('No active user with oneSignalPlayerId — trying sendToAll');
  } else {
    console.log('Test user:', user.email, 'playerId:', user.oneSignalPlayerId.slice(0, 8) + '...');
  }

  const send = await postJson(
    '/api/admin/send-notification',
    {
      title: 'Local API test',
      message: 'Notification from testLocalNotification.js',
      sendToAll: !user,
      userIds: user ? [String(user._id)] : undefined,
      deliveryMode: 'now',
      type: 'General',
    },
    { token, Authorization: `Bearer ${token}` }
  );

  console.log('HTTP', send.status);
  console.log('Success:', send.data?.success);
  console.log('Message:', send.data?.message);
  if (send.data?.error) console.log('Error:', send.data.error);
  if (send.data?.onesignal?.id) console.log('OneSignal id:', send.data.onesignal.id);
  return send.data?.success === true;
}

(async () => {
  console.log('Local notification test');
  console.log('ONESIGNAL_APP_ID set:', Boolean(process.env.ONESIGNAL_APP_ID));
  console.log('ONESIGNAL_REST_API_KEY set:', Boolean(process.env.ONESIGNAL_REST_API_KEY));

  const directOk = await testOneSignalDirect();
  const apiOk = await testLocalApi();

  console.log('\n=== Summary ===');
  console.log('OneSignal direct:', directOk ? 'PASS' : 'FAIL');
  console.log('Local API:', apiOk === null ? 'SKIPPED' : apiOk ? 'PASS' : 'FAIL');
  process.exit(directOk && apiOk !== false ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
