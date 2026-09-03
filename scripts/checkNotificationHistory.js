const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Notification = require('../modules/model/notificationModel');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });
  const sent = await Notification.find({ status: 'Sent' })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  const failed = await Notification.find({ status: 'Failed' })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  console.log('Recent SENT:', sent.length);
  sent.forEach((n) =>
    console.log(' ', n.createdAt?.toISOString?.(), n.title?.slice(0, 40), 'onesignalId:', n.onesignal?.notificationId || '-')
  );
  console.log('\nRecent FAILED:', failed.length);
  failed.forEach((n) =>
    console.log(' ', n.createdAt?.toISOString?.(), n.title?.slice(0, 40), 'error:', (n.error || '').slice(0, 80))
  );
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
