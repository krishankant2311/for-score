/**
 * Scan MongoDB for /uploads/* media references and sync files into ./uploads/.
 * DB stores URL strings only — this downloads from legacy hosts (Render, etc.).
 *
 * Dry run:  node scripts/syncUploadsFromDb.js --dry-run
 * Download: node scripts/syncUploadsFromDb.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const { extractUploadsWebPath } = require('../utils/publicFileUrl');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const LEGACY_HOSTS = [
  'for-score.onrender.com',
  'onrender.com',
  '72.167.43.139',
  'localhost',
  '127.0.0.1',
];

const isDryRun = process.argv.includes('--dry-run');

const UPLOAD_FILE_RE = /^\d{10,}-\d+\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv|pdf)$/i;

const isUploadMediaReference = (raw) => {
  const t = String(raw || '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return extractUploadsWebPath(t) != null;
  const lower = t.toLowerCase();
  if (lower.includes('/uploads/') || lower.startsWith('uploads/')) return true;
  if (UPLOAD_FILE_RE.test(t)) return true;
  return false;
};

const collectUploadStrings = (node, out) => {
  if (node == null) return;
  if (typeof node === 'string') {
    const t = node.trim();
    if (isUploadMediaReference(t)) out.push(t);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectUploadStrings(item, out);
    return;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) collectUploadStrings(v, out);
  }
};

const filenameFromUploadsPath = (webPath) => {
  const base = path.basename(String(webPath || '').replace(/\\/g, '/'));
  return base || null;
};

const sourceUrlCandidates = (raw) => {
  const webPath = extractUploadsWebPath(raw);
  if (!webPath) return [];
  const file = filenameFromUploadsPath(webPath);
  if (!file) return [];

  const candidates = new Set();
  if (/^https?:\/\//i.test(raw)) candidates.add(raw);

  for (const host of LEGACY_HOSTS) {
    candidates.add(`https://${host}${webPath}`);
    candidates.add(`http://${host}${webPath}`);
  }
  candidates.add(`https://for-score.onrender.com${webPath}`);
  return [...candidates];
};

const downloadFile = (url, destPath) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 30000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
      file.on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 20000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const programs = await Program.find({}).lean();
  const allStrings = [];
  for (const p of programs) collectUploadStrings(p, allStrings);

  const byFile = new Map();
  for (const raw of allStrings) {
    const webPath = extractUploadsWebPath(raw);
    if (!webPath) continue;
    const file = filenameFromUploadsPath(webPath);
    if (!file) continue;
    if (!byFile.has(file)) {
      byFile.set(file, { webPath, sources: new Set(), rawSamples: new Set() });
    }
    const entry = byFile.get(file);
    entry.rawSamples.add(raw);
    for (const u of sourceUrlCandidates(raw)) entry.sources.add(u);
  }

  const existing = new Set(
    fs.readdirSync(UPLOADS_DIR).filter((f) => f !== '.gitkeep')
  );

  const report = {
    programsScanned: programs.length,
    uniqueUploadFiles: byFile.size,
    alreadyOnDisk: 0,
    downloaded: 0,
    failed: [],
    missing: [],
  };

  console.log(`Programs scanned: ${report.programsScanned}`);
  console.log(`Unique /uploads/ files referenced in DB: ${report.uniqueUploadFiles}`);
  console.log(`Files already in uploads/: ${[...byFile.keys()].filter((f) => existing.has(f)).length}`);
  console.log('');

  for (const [file, meta] of [...byFile.entries()].sort()) {
    const dest = path.join(UPLOADS_DIR, file);
    if (existing.has(file)) {
      report.alreadyOnDisk += 1;
      console.log(`OK   exists  ${file}`);
      continue;
    }

    if (isDryRun) {
      report.missing.push(file);
      console.log(`MISS dry-run ${file}`);
      console.log(`     sample: ${[...meta.rawSamples][0]}`);
      continue;
    }

    let saved = false;
    for (const url of meta.sources) {
      try {
        await downloadFile(url, dest);
        const size = fs.statSync(dest).size;
        if (size < 100) {
          fs.unlinkSync(dest);
          throw new Error('file too small (likely HTML error page)');
        }
        report.downloaded += 1;
        saved = true;
        console.log(`DL   ok      ${file}  <=  ${url}`);
        break;
      } catch (err) {
        // try next source
      }
    }

    if (!saved) {
      report.failed.push(file);
      console.log(`FAIL missing  ${file}`);
      console.log(`     tried ${meta.sources.size} URL(s); re-upload via admin if needed`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`On disk already: ${report.alreadyOnDisk}`);
  if (!isDryRun) console.log(`Downloaded: ${report.downloaded}`);
  console.log(`Still missing: ${isDryRun ? report.missing.length : report.failed.length}`);

  if ((isDryRun ? report.missing : report.failed).length) {
    console.log('\nRe-upload these via admin (not available on Render/legacy URLs):');
    for (const f of isDryRun ? report.missing : report.failed) console.log(`  - ${f}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('syncUploadsFromDb failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
