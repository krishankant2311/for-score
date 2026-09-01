/**
 * Replace legacy full URLs (Render, etc.) with /uploads/... paths in MongoDB.
 *
 * Dry run: node scripts/normalizeUploadPathsInDb.js --dry-run
 * Apply:    node scripts/normalizeUploadPathsInDb.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const User = require('../modules/model/userModel');
const Food = require('../modules/model/foodModel');
const NutritionItem = require('../modules/model/nutritionItemModel');
const StretchProgram = require('../modules/model/stretchProgramModel');
const RecoveryContent = require('../modules/model/recoveryContentModel');
const { extractUploadsWebPath } = require('../utils/publicFileUrl');

const UPLOAD_FILE_RE = /^\d{10,}-\d+\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv|pdf)$/i;

const apply = process.argv.includes('--apply');
const dryRun = !apply || process.argv.includes('--dry-run');

const normalizeUploadString = (value) => {
  if (typeof value !== 'string') return { value, changed: false };
  const raw = value.trim();
  if (!raw) return { value: '', changed: false };

  if (/^https?:\/\//i.test(raw)) {
    const webPath = extractUploadsWebPath(raw);
    if (webPath && webPath !== raw && raw.toLowerCase().includes('/uploads/')) {
      return { value: webPath, changed: true };
    }
    return { value: raw, changed: false };
  }

  const lower = raw.toLowerCase();
  if (lower.includes('/uploads/') || lower.startsWith('uploads/')) {
    const webPath = extractUploadsWebPath(raw);
    if (webPath && webPath !== raw) return { value: webPath, changed: true };
    return { value: raw, changed: false };
  }

  if (UPLOAD_FILE_RE.test(raw)) {
    const webPath = `/uploads/${raw}`;
    return { value: webPath, changed: webPath !== raw };
  }

  return { value: raw, changed: false };
};

const deepNormalize = (node, changes) => {
  if (node == null) return node;
  if (typeof node === 'string') {
    const { value, changed } = normalizeUploadString(node);
    if (changed) changes.push({ from: node, to: value });
    return value;
  }
  if (Array.isArray(node)) return node.map((item) => deepNormalize(item, changes));
  if (typeof node === 'object' && !(node instanceof Date) && !(node instanceof mongoose.Types.ObjectId)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = deepNormalize(v, changes);
    }
    return out;
  }
  return node;
};

async function normalizeCollection(Model, label) {
  const docs = await Model.find({}).lean();
  let updated = 0;
  let fieldChanges = 0;

  for (const doc of docs) {
    const changes = [];
    const next = deepNormalize(doc, changes);
    if (!changes.length) continue;

    fieldChanges += changes.length;
    updated += 1;

    if (dryRun) {
      console.log(`\n[${label}] ${doc._id} — ${changes.length} path(s) would change:`);
      for (const c of changes.slice(0, 5)) {
        console.log(`  ${c.from}`);
        console.log(`  -> ${c.to}`);
      }
      if (changes.length > 5) console.log(`  ... +${changes.length - 5} more`);
      continue;
    }

    await Model.replaceOne({ _id: doc._id }, next);
    console.log(`[${label}] updated ${doc._id} (${changes.length} path(s))`);
  }

  return { docs: docs.length, updated, fieldChanges };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 20000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  console.log(dryRun ? 'DRY RUN — no DB writes' : 'APPLYING changes to MongoDB');
  console.log('Render / full upload URLs -> /uploads/...\n');

  const collections = [
    [Program, 'programs'],
    [User, 'users'],
    [Food, 'foods'],
    [NutritionItem, 'nutrition_items'],
    [StretchProgram, 'stretch_programs'],
    [RecoveryContent, 'recovery_content'],
  ];

  let totalUpdated = 0;
  let totalFieldChanges = 0;

  for (const [Model, label] of collections) {
    const stats = await normalizeCollection(Model, label);
    console.log(
      `\n${label}: scanned ${stats.docs}, ${dryRun ? 'would update' : 'updated'} ${stats.updated} doc(s), ${stats.fieldChanges} path(s)`
    );
    totalUpdated += stats.updated;
    totalFieldChanges += stats.fieldChanges;
  }

  console.log('\n--- Total ---');
  console.log(`${dryRun ? 'Would update' : 'Updated'} documents: ${totalUpdated}`);
  console.log(`Path rewrites: ${totalFieldChanges}`);

  if (dryRun && totalUpdated > 0) {
    console.log('\nRun with --apply to save: node scripts/normalizeUploadPathsInDb.js --apply');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('normalizeUploadPathsInDb failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
