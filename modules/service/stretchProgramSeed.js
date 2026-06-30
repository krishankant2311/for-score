const StretchProgram = require('../model/stretchProgramModel');
const {
  STRETCH_PROGRAM_SEED_ID,
  LEGACY_STRETCH_PROGRAM_SEED_IDS,
  STRETCH_PROGRAM_DEFAULT_ROWS,
} = require('./stretchProgramSeedData');

const slugIconKey = (title) =>
  String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'stretch_default';

async function ensureStretchProgramSeed() {
  const seedIds = [STRETCH_PROGRAM_SEED_ID, ...LEGACY_STRETCH_PROGRAM_SEED_IDS];
  const existing = await StretchProgram.countDocuments({
    seedSource: STRETCH_PROGRAM_SEED_ID,
    status: { $ne: 'Deleted' },
  });

  const expected = STRETCH_PROGRAM_DEFAULT_ROWS.length;
  if (existing >= expected) {
    await StretchProgram.deleteMany({ seedSource: { $in: LEGACY_STRETCH_PROGRAM_SEED_IDS } });
    return { inserted: 0, skipped: true };
  }

  await StretchProgram.deleteMany({ seedSource: { $in: seedIds } });

  const docs = STRETCH_PROGRAM_DEFAULT_ROWS.map((row) => {
    const intro = String(row.intro || '').trim();
    const description = String(row.description || intro).trim();
    const movements = Array.isArray(row.movements) ? row.movements : [];
    return {
      title: row.title,
      category: row.category || 'Recover',
      intro,
      description,
      level: row.level || 'All Levels',
      durationMinutes: Number(row.durationMinutes) || 5,
      stretchCount: movements.length,
      movements,
      iconKey: slugIconKey(row.title),
      sortOrder: Number(row.sortOrder) || 0,
      status: 'Active',
      seedSource: STRETCH_PROGRAM_SEED_ID,
    };
  });

  await StretchProgram.insertMany(docs);
  console.log(`Stretch programs: inserted ${docs.length} default programs`);
  return { inserted: docs.length, skipped: false };
}

module.exports = { ensureStretchProgramSeed };
