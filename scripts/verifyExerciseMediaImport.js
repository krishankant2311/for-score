require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const ps = await Program.find({ status: { $ne: 'Deleted' } }).lean();
  let v = 0;
  let t = 0;
  let b = 0;
  let n = 0;

  for (const p of ps) {
    for (const lib of [p.exerciseLibrary, p.workouts]) {
      if (!lib) continue;
      for (const k of Object.keys(lib)) {
        for (const ex of lib[k] || []) {
          if (typeof ex !== 'object') continue;
          n += 1;
          if (ex.video_url) v += 1;
          if (ex.thumbnail_url) t += 1;
          if (ex.backup_video_url) b += 1;
        }
      }
    }
  }

  console.log('Programs:', ps.length);
  console.log('Exercise objects:', n);
  console.log('With video_url:', v);
  console.log('With thumbnail_url:', t);
  console.log('With backup_video_url:', b);

  const q = await Program.findOne({ programCode: 'express_15_minute' }).lean();
  const mon = (q.workouts && q.workouts.A) || [];
  console.log('express_15_minute Monday sample:');
  for (const ex of mon.slice(0, 5)) {
    const vid = ex.video_url ? `${ex.video_url.slice(0, 55)}...` : '(no video)';
    const bak = ex.backup_video_url ? `${ex.backup_video_url.slice(0, 55)}...` : '(no backup)';
    console.log(`  ${ex.name}`);
    console.log(`    video: ${vid}`);
    console.log(`    backup: ${bak}`);
  }

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
