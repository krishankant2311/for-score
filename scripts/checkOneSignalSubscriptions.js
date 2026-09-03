/**
 * Count users with OneSignal subscription ids saved in MongoDB.
 * node scripts/checkOneSignalSubscriptions.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../modules/model/userModel');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const total = await User.countDocuments({});
  const withPlayer = await User.countDocuments({
    $or: [
      { oneSignalPlayerId: { $exists: true, $nin: [null, ''] } },
      { oneSignalPlayerIds: { $exists: true, $not: { $size: 0 } } },
    ],
  });
  const activeWithPlayer = await User.countDocuments({
    status: 'Active',
    $or: [
      { oneSignalPlayerId: { $exists: true, $nin: [null, ''] } },
      { oneSignalPlayerIds: { $exists: true, $not: { $size: 0 } } },
    ],
  });

  console.log('Users total:', total);
  console.log('Users with OneSignal subscription id:', withPlayer);
  console.log('Active users with OneSignal subscription id:', activeWithPlayer);

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
