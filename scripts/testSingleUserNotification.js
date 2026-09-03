/**
 * Test single-user notification (does not use admin login).
 * node scripts/testSingleUserNotification.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../modules/model/userModel');
const {
  sendOneSignalNotification,
  isOneSignalDeliveryOk,
  getOneSignalDeliveryError,
} = require('../modules/service/oneSignalService');

(async () => {
  console.log('App ID:', process.env.ONESIGNAL_APP_ID);
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const user = await User.findOne({
    status: 'Active',
    oneSignalPlayerId: { $exists: true, $nin: [null, ''] },
  })
    .select('email oneSignalPlayerId oneSignalPlayerIds')
    .lean();

  if (!user) {
    console.log('No active user with oneSignalPlayerId in DB.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const playerId = String(user.oneSignalPlayerId).trim();
  console.log('Test user:', user.email);
  console.log('Subscription id:', playerId.slice(0, 8) + '...' + playerId.slice(-4));
  console.log('');

  try {
    const resp = await sendOneSignalNotification({
      title: 'Four Score single-user test',
      message: 'Test notification to one user — you can ignore this.',
      playerIds: [playerId],
      data: { test: 'single-user' },
    });

    const ok = isOneSignalDeliveryOk(resp);
    console.log('Result:', ok ? 'PASS — notification accepted by OneSignal' : 'FAIL');
    console.log('OneSignal notification id:', resp?.id || '(none)');
    console.log('Recipients:', resp?.recipients ?? 'n/a');
    if (!ok) {
      console.log('Error:', getOneSignalDeliveryError(resp) || resp?.errors);
    }
    if (resp?._deliveryEndpoint) console.log('Endpoint:', resp._deliveryEndpoint);

    await mongoose.disconnect();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.log('FAIL:', err.message);
    if (err.response) console.log('Response:', JSON.stringify(err.response));
    await mongoose.disconnect();
    process.exit(1);
  }
})();
