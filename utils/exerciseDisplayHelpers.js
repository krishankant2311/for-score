const MAX_MUSCLE_TAG_LEN = 40;
const MAX_MUSCLE_TAGS = 6;
const MAX_MUSCLES_LINE_LEN = 96;
const MAX_TARGET_MUSCLES_TEXT_INPUT = 120;

const truncateWithEllipsis = (text, maxLen) => {
  const t = String(text ?? '').trim();
  if (!t || t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
};

const parseMusclesFromExerciseFields = (o) => {
  if (o == null || o === '') return [];
  if (Array.isArray(o)) return o.map((x) => String(x).trim()).filter(Boolean);

  const raw =
    o.target_muscles ??
    o.targetMuscles ??
    o.muscles_involved ??
    o.muscles ??
    o.targetMusclesText ??
    o.target_muscles_text ??
    '';

  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);

  try {
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return [];
      if (t.startsWith('[')) {
        const arr = JSON.parse(t);
        return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];
      }
      return t
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  } catch (_) {
    /* ignore */
  }
  return [];
};

const sanitizeMusclesList = (muscles) => {
  const seen = new Set();
  const out = [];
  for (const raw of muscles || []) {
    const tag = truncateWithEllipsis(raw, MAX_MUSCLE_TAG_LEN);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_MUSCLE_TAGS) break;
  }
  return out;
};

const buildMusclesDisplayLine = (muscles) => {
  const line = (muscles || []).join(', ');
  return truncateWithEllipsis(line, MAX_MUSCLES_LINE_LEN);
};

const resolveProgramSkillLevel = (program) =>
  String(program?.workoutSkillLevel ?? program?.level ?? '').trim();

/** Program skill level wins when set so admin level edits reflect in the app immediately. */
const resolveExerciseDifficultyLevel = (exerciseRaw, program) => {
  const programLevel = resolveProgramSkillLevel(program);
  const exerciseLevel = String(
    exerciseRaw?.difficulty_level ?? exerciseRaw?.difficultyLevel ?? exerciseRaw?.difficulty ?? ''
  ).trim();
  return programLevel || exerciseLevel || null;
};

const sanitizeExerciseLibraryEntry = (exercise, programLevel) => {
  if (!exercise || typeof exercise !== 'object' || typeof exercise === 'string') return exercise;

  const muscles = sanitizeMusclesList(parseMusclesFromExerciseFields(exercise));
  exercise.target_muscles = muscles;
  exercise.targetMuscles = muscles;

  const displayLine = buildMusclesDisplayLine(muscles);
  const rawText = String(exercise.targetMusclesText ?? exercise.target_muscles_text ?? '').trim();
  exercise.targetMusclesText = truncateWithEllipsis(rawText || displayLine, MAX_TARGET_MUSCLES_TEXT_INPUT);
  exercise.target_muscles_text = exercise.targetMusclesText;

  const level = resolveExerciseDifficultyLevel(exercise, { workoutSkillLevel: programLevel });
  if (level) {
    exercise.difficulty_level = level;
    exercise.difficultyLevel = level;
  }

  return exercise;
};

const sanitizeExerciseLibrary = (library, programLevel) => {
  if (!library || typeof library !== 'object') return;
  for (const key of Object.keys(library)) {
    const val = library[key];
    if (Array.isArray(val)) {
      library[key] = val.map((ex) => sanitizeExerciseLibraryEntry(ex, programLevel));
    } else if (val && typeof val === 'object') {
      library[key] = sanitizeExerciseLibraryEntry(val, programLevel);
    }
  }
};

module.exports = {
  MAX_MUSCLE_TAG_LEN,
  MAX_MUSCLE_TAGS,
  MAX_MUSCLES_LINE_LEN,
  MAX_TARGET_MUSCLES_TEXT_INPUT,
  truncateWithEllipsis,
  parseMusclesFromExerciseFields,
  sanitizeMusclesList,
  buildMusclesDisplayLine,
  resolveProgramSkillLevel,
  resolveExerciseDifficultyLevel,
  sanitizeExerciseLibraryEntry,
  sanitizeExerciseLibrary,
};
