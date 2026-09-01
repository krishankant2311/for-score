const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const { extractUploadsWebPath } = require('../utils/publicFileUrl');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });
  const programs = await Program.find({ status: { $ne: 'Deleted' } });
  const missing = [];
  const ok = new Set();
  for (const p of programs) {
    for (const field of ['videoPath', 'thumbnail_url']) {
      const raw = String(p[field] || '').trim();
      const webPath = raw ? extractUploadsWebPath(raw) : null;
      if (!webPath) continue;
      const file = path.join(__dirname, '../uploads', path.basename(webPath));
      if (fs.existsSync(file) && fs.statSync(file).size > 500) ok.add(path.basename(file));
      else missing.push({ code: p.programCode, field, path: webPath });
    }
  }
  console.log('Files on disk matching DB:', ok.size);
  console.log([...ok].sort().join('\n'));
  console.log('\nMissing:', missing.length);
  missing.forEach((m) => console.log(`  ${m.code} ${m.field} ${m.path}`));
  await mongoose.disconnect();
})();
