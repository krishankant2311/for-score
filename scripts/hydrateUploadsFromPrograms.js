/**
 * Download missing /uploads/* program cover files from first exercise YouTube thumbnail.
 *
 * Dry run: node scripts/hydrateUploadsFromPrograms.js --dry-run
 * Apply:    node scripts/hydrateUploadsFromPrograms.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const { extractUploadsWebPath } = require('../utils/publicFileUrl');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const dryRun = process.argv.includes('--dry-run');

const download = (url, dest) =>
  new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const opts = {
      timeout: 30000,
      agent: new https.Agent({ rejectUnauthorized: false }),
    };
    https
      .get(url, opts, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
        file.on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
      })
      .on('error', reject);
  });

const firstExerciseThumbnail = (program) => {
  const lib = program.exerciseLibrary;
  if (!lib || typeof lib !== 'object') return '';
  for (const key of Object.keys(lib)) {
    const arr = lib[key];
    if (!Array.isArray(arr)) continue;
    for (const ex of arr) {
      if (!ex || typeof ex !== 'object') continue;
      const thumb = String(ex.thumbnail_url || '').trim();
      if (thumb.startsWith('http')) return thumb;
      const video = String(ex.video_url || '').trim();
      const m = video.match(/embed\/([^?&/]+)/i);
      if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
    }
  }
  return '';
};

const coverWebPath = (program) => {
  for (const field of ['videoPath', 'thumbnail_url']) {
    const raw = String(program[field] || '').trim();
    const webPath = raw ? extractUploadsWebPath(raw) : null;
    if (webPath) return webPath;
  }
  return '';
};

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const programs = await Program.find({ status: { $ne: 'Deleted' } });
  let downloaded = 0;
  let skipped = 0;
  let dbUpdated = 0;

  for (const program of programs) {
    const thumbUrl = firstExerciseThumbnail(program);
    if (!thumbUrl) {
      console.log(`SKIP no-youtube  ${program.programCode}`);
      continue;
    }

    let webPath = coverWebPath(program);
    let needsDbUpdate = false;

    if (!webPath) {
      webPath = `/uploads/${Date.now()}-${program._id.toString().slice(-8)}.jpg`;
      needsDbUpdate = true;
    }

    const filename = path.basename(webPath);
    const dest = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      console.log(`OK   exists  ${filename} [${program.programCode}]`);
      skipped += 1;
      if (needsDbUpdate && !dryRun) {
        program.videoPath = webPath;
        program.thumbnail_url = webPath;
        await program.save();
        dbUpdated += 1;
      }
      continue;
    }

    if (dryRun) {
      console.log(`DL   dry-run ${filename} [${program.programCode}]`);
      continue;
    }

    try {
      await download(thumbUrl, dest);
      const size = fs.statSync(dest).size;
      if (size < 500) {
        fs.unlinkSync(dest);
        throw new Error('download too small');
      }
      downloaded += 1;
      console.log(`DL   ok      ${filename} (${size} bytes) [${program.programCode}]`);

      if (needsDbUpdate || !coverWebPath(program)) {
        program.videoPath = webPath;
        program.thumbnail_url = webPath;
        await program.save();
        dbUpdated += 1;
      }
    } catch (err) {
      console.log(`FAIL         ${filename} [${program.programCode}] — ${err.message}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Programs: ${programs.length}`);
  console.log(`Already on disk: ${skipped}`);
  if (!dryRun) {
    console.log(`Downloaded: ${downloaded}`);
    console.log(`DB updated: ${dbUpdated}`);
    const onDisk = fs.readdirSync(UPLOADS_DIR).filter((f) => f !== '.gitkeep');
    console.log(`uploads/ has ${onDisk.length} file(s)`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('hydrateUploadsFromPrograms failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
