const fs = require('fs');
const path = require('path');

const PROGRAM_CODES = [
  'foundations_28_day',
  'intermediate_strength_8_week',
  'elite_mastery_8_week',
  'ignite_28_day',
  'shred_burn_hiit',
  'elite_metabolic',
  'bodyweight_basics',
  'core_flow',
  'functional_strength_mastery',
  'united_frontier_crossfit',
  'express_15_minute',
  'radiant_forge_prenatal',
  'shred_to_stage_12_week',
];

const CLIENT_PROGRAM_ALIASES = {
  'full body foundations': 'foundations_28_day',
  '28-day full body foundations': 'foundations_28_day',
  '8-wk intermediate strength': 'intermediate_strength_8_week',
  '8-wk elite strength': 'elite_mastery_8_week',
  'elite metabolic': 'elite_metabolic',
  'functional strength & mastery': 'functional_strength_mastery',
  'functional strength and mastery': 'functional_strength_mastery',
  'united frontier': 'united_frontier_crossfit',
  'crossfit: the united frontier': 'united_frontier_crossfit',
  'radiant forge': 'radiant_forge_prenatal',
  'prenatal: the radiant forge': 'radiant_forge_prenatal',
  'shred to stage': 'shred_to_stage_12_week',
  '12-week shred to stage': 'shred_to_stage_12_week',
  'shred & burn hiit': 'shred_burn_hiit',
  '15-min express': 'express_15_minute',
  '15-minute quick hits': 'express_15_minute',
  '28-day ignite': 'ignite_28_day',
  'low-impact cardio: 28-day ignite': 'ignite_28_day',
  'bodyweight basics': 'bodyweight_basics',
  'core & flow': 'core_flow',
};

const DEFAULT_TSV = path.join(__dirname, '../../data/exerciseMediaCatalog.tsv');

const normalizeName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const singularize = (norm) =>
  String(norm || '')
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ')
    .trim();

function resolveProgramCode(label) {
  const raw = String(label || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (CLIENT_PROGRAM_ALIASES[key]) return CLIENT_PROGRAM_ALIASES[key];
  for (const [alias, code] of Object.entries(CLIENT_PROGRAM_ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) return code;
  }
  return null;
}

function youtubeThumbnail(youtubeId) {
  const id = String(youtubeId || '').trim();
  if (!id) return '';
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function youtubeEmbed(youtubeId) {
  const id = String(youtubeId || '').trim();
  if (!id) return '';
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

function extractYoutubeId(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  let m = s.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (m) return m[1];
  m = s.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (m) return m[1];
  m = s.match(/[?&]v=([^?&/]+)/i);
  if (m) return m[1];
  m = s.match(/youtu\.be\/([^?&/]+)/i);
  if (m) return m[1];
  return '';
}

function normalizeYoutubeVideoUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const id = extractYoutubeId(raw);
  if (id) return youtubeEmbed(id);
  return raw;
}

function parseCatalogTsv(filePath = DEFAULT_TSV) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split('\t');
    const exerciseName = (cols[0] || '').trim();
    const programsUsedIn = cols[3] || '';
    const youtubeId = (cols[5] || '').trim();
    let embedUrl = (cols[6] || '').trim();
    let thumbnailUrl = (cols[7] || '').trim();
    let backupVideoUrl = normalizeYoutubeVideoUrl(cols[10] || '');
    const notes = (cols[11] || '').trim();

    if (!exerciseName) continue;
    if (/no demo needed/i.test(notes)) continue;

    if (!embedUrl && youtubeId) embedUrl = youtubeEmbed(youtubeId);
    if (!thumbnailUrl && youtubeId) thumbnailUrl = youtubeThumbnail(youtubeId);
    if (!embedUrl) continue;
    if (backupVideoUrl && backupVideoUrl === embedUrl) backupVideoUrl = '';

    const programCodes = [];
    const unknownPrograms = [];
    for (const part of programsUsedIn.split(';')) {
      const label = part.trim();
      if (!label) continue;
      if (/all programs/i.test(label)) continue;
      const code = resolveProgramCode(label);
      if (code) {
        if (!programCodes.includes(code)) programCodes.push(code);
      } else {
        unknownPrograms.push(label);
      }
    }

    rows.push({
      exerciseName,
      norm: normalizeName(exerciseName),
      programCodes,
      embedUrl,
      thumbnailUrl,
      backupVideoUrl,
      unknownPrograms,
    });
  }
  return rows;
}

function collectProgramExerciseNames(program) {
  const out = [];
  for (const lib of [program.exerciseLibrary, program.workouts]) {
    if (!lib || typeof lib !== 'object') continue;
    for (const key of Object.keys(lib)) {
      const arr = lib[key];
      if (!Array.isArray(arr)) continue;
      for (const ex of arr) {
        const name = typeof ex === 'string' ? ex : ex?.name;
        if (!name) continue;
        out.push({
          name: String(name).trim(),
          norm: normalizeName(name),
        });
      }
    }
  }
  return out;
}

const EQUIPMENT_PREFIXES = new Set([
  'barbell',
  'dumbbell',
  'db',
  'kb',
  'kettlebell',
  'bodyweight',
  'banded',
  'air',
]);

const coreExerciseNorm = (norm) => {
  const parts = String(norm || '')
    .split(' ')
    .filter(Boolean);
  while (parts.length > 1 && EQUIPMENT_PREFIXES.has(parts[0])) {
    parts.shift();
  }
  return parts.join(' ');
};

function findBestMatch(clientNorm, dbExercises) {
  const byNorm = new Map();
  for (const ex of dbExercises) {
    if (!byNorm.has(ex.norm)) byNorm.set(ex.norm, ex);
  }
  if (byNorm.has(clientNorm)) return byNorm.get(clientNorm);

  const clientCore = singularize(coreExerciseNorm(clientNorm));
  for (const [norm, rec] of byNorm.entries()) {
    const dbCore = singularize(coreExerciseNorm(norm));
    if (clientCore && dbCore && clientCore === dbCore) return rec;
    if (clientCore && singularize(norm) === clientCore) return rec;
    if (dbCore && singularize(clientNorm) === dbCore) return rec;
  }

  const clientSing = singularize(clientNorm);
  for (const [norm, rec] of byNorm.entries()) {
    if (norm.includes(clientNorm) || clientNorm.includes(norm)) return rec;
    const normSing = singularize(norm);
    if (normSing && clientSing && (normSing.includes(clientSing) || clientSing.includes(normSing))) {
      return rec;
    }
  }

  const tokens = clientNorm.split(' ').filter((t) => t.length > 2);
  const dbNames = [...byNorm.values()];
  for (const rec of dbNames) {
    const hit = tokens.filter((t) => rec.norm.includes(t)).length;
    if (hit >= Math.max(2, Math.ceil(tokens.length * 0.6))) return rec;
  }
  return null;
}

function applyMediaToExercise(exercise, embedUrl, thumbnailUrl, backupVideoUrl) {
  if (!exercise || typeof exercise !== 'object') return false;
  let changed = false;
  if (embedUrl && exercise.video_url !== embedUrl) {
    exercise.video_url = embedUrl;
    exercise.media_type = 'video';
    changed = true;
  }
  if (thumbnailUrl && exercise.thumbnail_url !== thumbnailUrl) {
    exercise.thumbnail_url = thumbnailUrl;
    changed = true;
  }
  if (backupVideoUrl && exercise.backup_video_url !== backupVideoUrl) {
    exercise.backup_video_url = backupVideoUrl;
    changed = true;
  }
  return changed;
}

function updateProgramWithMatch(program, matchedDbNorm, embedUrl, thumbnailUrl) {
  let slotUpdates = 0;
  for (const container of [program.exerciseLibrary, program.workouts]) {
    if (!container || typeof container !== 'object') continue;
    for (const key of Object.keys(container)) {
      const arr = container[key];
      if (!Array.isArray(arr)) continue;
      for (const ex of arr) {
        const name = typeof ex === 'string' ? ex : ex?.name;
        if (!name || typeof ex !== 'object') continue;
        if (normalizeName(name) === matchedDbNorm && applyMediaToExercise(ex, embedUrl, thumbnailUrl, '')) {
          slotUpdates += 1;
        }
      }
    }
  }
  return slotUpdates;
}

function fuzzyNormMatches(dbNorm, matchedDbNorm) {
  if (dbNorm === matchedDbNorm) return true;
  const a = singularize(dbNorm);
  const b = singularize(matchedDbNorm);
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aCore = coreExerciseNorm(a);
  const bCore = coreExerciseNorm(b);
  return Boolean(aCore && bCore && (aCore === bCore || aCore.includes(bCore) || bCore.includes(aCore)));
}

function updateProgramWithFuzzyMatch(program, matchedDbNorm, embedUrl, thumbnailUrl, backupVideoUrl) {
  let slotUpdates = 0;
  for (const container of [program.exerciseLibrary, program.workouts]) {
    if (!container || typeof container !== 'object') continue;
    for (const key of Object.keys(container)) {
      const arr = container[key];
      if (!Array.isArray(arr)) continue;
      for (const ex of arr) {
        const name = typeof ex === 'string' ? ex : ex?.name;
        if (!name || typeof ex !== 'object') continue;
        if (fuzzyNormMatches(normalizeName(name), matchedDbNorm)) {
          if (applyMediaToExercise(ex, embedUrl, thumbnailUrl, backupVideoUrl)) slotUpdates += 1;
        }
      }
    }
  }
  return slotUpdates;
}

async function importExerciseMedia({ Program, dryRun = false, tsvPath = DEFAULT_TSV } = {}) {
  if (!Program) throw new Error('Program model is required');

  const catalogRows = parseCatalogTsv(tsvPath);
  const programs = await Program.find({
    programCode: { $in: PROGRAM_CODES },
    status: { $ne: 'Deleted' },
  });

  const programByCode = new Map(programs.map((p) => [p.programCode, p]));
  const stats = {
    dryRun,
    catalogRows: catalogRows.length,
    programUpdates: 0,
    slotUpdates: 0,
    applied: [],
    skippedNoProgram: [],
    skippedNoExercise: [],
    unknownProgramLabels: new Set(),
  };

  for (const row of catalogRows) {
    for (const unknown of row.unknownPrograms) {
      stats.unknownProgramLabels.add(unknown);
    }

    for (const programCode of row.programCodes) {
      const program = programByCode.get(programCode);
      if (!program) {
        stats.skippedNoProgram.push({
          exerciseName: row.exerciseName,
          programCode,
        });
        continue;
      }

      const dbExercises = collectProgramExerciseNames(program);
      const match = findBestMatch(row.norm, dbExercises);
      if (!match) {
        stats.skippedNoExercise.push({
          exerciseName: row.exerciseName,
          programCode,
        });
        continue;
      }

      const matchedNorm = match.norm;
      const slotUpdates = updateProgramWithFuzzyMatch(
        program,
        matchedNorm,
        row.embedUrl,
        row.thumbnailUrl,
        row.backupVideoUrl
      );

      if (slotUpdates > 0) {
        stats.slotUpdates += slotUpdates;
        stats.applied.push({
          exerciseName: row.exerciseName,
          matchedName: match.name,
          programCode,
          slotUpdates,
        });
      }
    }
  }

  const touchedCodes = new Set(stats.applied.map((a) => a.programCode));
  if (!dryRun) {
    for (const code of touchedCodes) {
      const program = programByCode.get(code);
      if (program) {
        program.markModified('exerciseLibrary');
        program.markModified('workouts');
        await program.save();
        stats.programUpdates += 1;
      }
    }
  } else {
    stats.programUpdates = touchedCodes.size;
  }

  stats.unknownProgramLabels = [...stats.unknownProgramLabels];
  return stats;
}

module.exports = {
  PROGRAM_CODES,
  CLIENT_PROGRAM_ALIASES,
  normalizeName,
  normalizeYoutubeVideoUrl,
  parseCatalogTsv,
  importExerciseMedia,
};
