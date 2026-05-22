const { toPublicFileUrl } = require('./publicFileUrl');

/** Persist full public URL (same shape as API responses) so DB rows work from Render/mobile. */
const persistedUploadPublicUrl = (req, multerDiskPath) => {
  if (!multerDiskPath) return '';
  const url = toPublicFileUrl(req, multerDiskPath);
  return url || String(multerDiskPath).trim();
};

const filePathToWebPath = (absPath) => {
  if (!absPath) return '';
  const n = String(absPath).replace(/\\/g, '/').trim();
  const i = n.toLowerCase().lastIndexOf('/uploads/');
  return i >= 0 ? n.slice(i) : n;
};

const shouldRewriteMediaString = (s) => {
  const t = String(s).trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (t.includes('/uploads/') || /\\uploads\\/i.test(t)) return true;
  if (/^[a-z]:\\.*uploads\\/i.test(t)) return true;
  return false;
};

const deepCloneJson = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (_) {
    return obj;
  }
};

const remapMediaStringsInMixed = (req, node) => {
  if (node == null) return node;
  if (typeof node === 'string') {
    return shouldRewriteMediaString(node) ? toPublicFileUrl(req, node) : node;
  }
  if (Array.isArray(node)) return node.map((x) => remapMediaStringsInMixed(req, x));
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = remapMediaStringsInMixed(req, v);
    }
    return out;
  }
  return node;
};

const parsePathSegments = (pathStr) =>
  String(pathStr || '')
    .split('.')
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));

const setByPath = (root, pathStr, value) => {
  const segments = parsePathSegments(pathStr);
  if (!segments.length) return;
  let cur = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const k = segments[i];
    const next = segments[i + 1];
    if (cur[k] == null) cur[k] = typeof next === 'number' ? [] : {};
    cur = cur[k];
  }
  cur[segments[segments.length - 1]] = value;
};

const isVideoMediaUrl = (url) =>
  /\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|#|$)/i.test(String(url || '').trim());

const isImageMediaUrl = (url) =>
  /\.(png|jpe?g|gif|webp|svg|bmp|heic|avif)(\?|#|$)/i.test(String(url || '').trim());

/** Keep video_url / thumbnail_url and mediaUrls[] in sync on one library exercise row. */
const applyMediaFieldToExercise = (exercise, field, url) => {
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) return;
  const u = String(url || '').trim();
  if (!u) return;

  const f = String(field || '').trim();
  if (f === 'video_url' || f === 'videoUrl') {
    exercise.video_url = u;
    exercise.videoUrl = u;
    exercise.media_type = exercise.media_type || exercise.mediaType || 'video';
    exercise.mediaType = exercise.media_type;
  } else if (f === 'thumbnail_url' || f === 'thumbnailUrl') {
    exercise.thumbnail_url = u;
    exercise.thumbnailUrl = u;
  } else if (f === 'media_url' || f === 'mediaUrl') {
    if (isVideoMediaUrl(u)) {
      exercise.video_url = u;
      exercise.media_type = 'video';
    } else {
      exercise.thumbnail_url = u;
    }
  }

  const urls = [];
  const push = (x) => {
    const s = String(x || '').trim();
    if (s && !urls.includes(s)) urls.push(s);
  };
  push(exercise.video_url);
  push(exercise.videoUrl);
  push(exercise.thumbnail_url);
  push(exercise.thumbnailUrl);
  if (Array.isArray(exercise.mediaUrls)) {
    for (const x of exercise.mediaUrls) push(x);
  }
  exercise.mediaUrls = urls;
};

/** After setByPath, also mirror A↔workoutA (and B/C) so admin + mobile stay aligned. */
const mirrorLibraryMediaPath = (exerciseLibraryObj, pathStr, url) => {
  const segments = parsePathSegments(pathStr);
  if (segments.length < 3) return;

  let letter = String(segments[0]).toUpperCase();
  if (letter.startsWith('WORKOUT') && letter.length === 7) {
    letter = letter.slice(7);
  }
  const idx = segments[1];
  const field = segments[2];
  if (!/^[ABC]$/.test(letter) || typeof idx !== 'number') return;

  const altKey = `workout${letter.toUpperCase()}`;
  const primaryList = exerciseLibraryObj[letter.toUpperCase()];
  const altList = exerciseLibraryObj[altKey];

  const applyToRow = (row) => {
    if (!row || typeof row !== 'object') return;
    if (field === 'mediaUrls' && typeof segments[3] === 'number') {
      if (!Array.isArray(row.mediaUrls)) row.mediaUrls = [];
      row.mediaUrls[segments[3]] = url;
      applyMediaFieldToExercise(
        row,
        isVideoMediaUrl(url) ? 'video_url' : 'thumbnail_url',
        url
      );
      return;
    }
    applyMediaFieldToExercise(row, field, url);
  };

  if (Array.isArray(primaryList) && primaryList[idx]) applyToRow(primaryList[idx]);
  if (Array.isArray(altList) && altList[idx]) applyToRow(altList[idx]);
};

/** Duplicate A/B/C lists onto workoutA/workoutB/workoutC + UPPER/LOWER/FULL aliases. */
const syncExerciseLibraryWorkoutAliases = (exerciseLibraryObj) => {
  if (!exerciseLibraryObj || typeof exerciseLibraryObj !== 'object') return;

  const pairs = [
    ['A', 'workoutA', 'LOWER'],
    ['B', 'workoutB', 'UPPER'],
    ['C', 'workoutC', 'FULL'],
  ];

  for (const [letter, workoutKey, splitKey] of pairs) {
    const primary = exerciseLibraryObj[letter];
    if (!Array.isArray(primary) || !primary.length) continue;

    const cloned = primary.map((ex) => {
      if (!ex || typeof ex !== 'object') return ex;
      const copy = { ...ex };
      applyMediaFieldToExercise(copy, 'video_url', copy.video_url || copy.videoUrl);
      applyMediaFieldToExercise(copy, 'thumbnail_url', copy.thumbnail_url || copy.thumbnailUrl);
      return copy;
    });

    exerciseLibraryObj[workoutKey] = JSON.parse(JSON.stringify(cloned));
    exerciseLibraryObj[splitKey] = JSON.parse(JSON.stringify(cloned));
  }
};

const libraryExerciseToWorkoutRow = (libEx) => {
  if (!libEx || typeof libEx !== 'object') return libEx;
  const thumb = String(libEx.thumbnail_url || libEx.thumbnailUrl || '').trim();
  const urls = [];
  const push = (u) => {
    const s = String(u || '').trim();
    if (s && s !== thumb && !urls.includes(s)) urls.push(s);
  };
  push(libEx.video_url);
  push(libEx.videoUrl);
  if (Array.isArray(libEx.mediaUrls)) {
    for (const u of libEx.mediaUrls) push(u);
  }

  return {
    ...libEx,
    name: libEx.name,
    thumbnail_url: thumb,
    mediaUrls: urls,
    pendingUploads: [],
    thumbnailPending: null,
  };
};

/** Copy persisted media from exerciseLibrary into program.workouts for admin re-edit. */
const syncWorkoutsFromExerciseLibrary = (workouts, exerciseLibraryObj) => {
  if (!workouts || typeof workouts !== 'object' || Array.isArray(workouts)) return workouts;
  if (!exerciseLibraryObj || typeof exerciseLibraryObj !== 'object') return workouts;

  const out = { ...workouts };
  for (const letter of ['A', 'B', 'C']) {
    const libList =
      (Array.isArray(exerciseLibraryObj[letter]) && exerciseLibraryObj[letter]) ||
      (Array.isArray(exerciseLibraryObj[`workout${letter}`]) &&
        exerciseLibraryObj[`workout${letter}`]) ||
      [];
    const woList = Array.isArray(out[letter]) ? out[letter] : [];
    if (!libList.length) continue;

    out[letter] = woList.map((ex, i) => {
      const slotKey = String(ex?.slotKey ?? '').trim();
      let lib =
        libList[i] && typeof libList[i] === 'object' ? libList[i] : null;
      if (slotKey) {
        const hit = libList.find(
          (row) => row && String(row.slotKey ?? '').trim() === slotKey
        );
        if (hit) lib = hit;
      }
      if (!lib) return ex;
      const merged = {
        ...(typeof ex === 'object' && ex ? ex : {}),
        ...libraryExerciseToWorkoutRow(lib),
        name: String(ex?.name ?? lib.name ?? '').trim() || lib.name,
      };
      return merged;
    });
  }
  return out;
};

/**
 * multipart field `recovery_media` (multiple files).
 * Optional `recovery_media_targets` JSON array of dot-paths — same length as files, e.g.
 * ["cardio.media_url","stretchBlock.0.video_url"]
 */
const mergeRecoveryMediaUploads = (req, recoveryProtocolObj) => {
  if (!recoveryProtocolObj || typeof recoveryProtocolObj !== 'object') return;
  const raw = req.files?.recovery_media;
  const files = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!files.length) return;

  let targets = null;
  try {
    const t = req.body?.recovery_media_targets;
    if (t != null && String(t).trim()) targets = JSON.parse(String(t));
  } catch (_) {
    targets = null;
  }

  if (Array.isArray(targets) && targets.length) {
    files.forEach((file, i) => {
      if (!file?.path || !targets[i]) return;
      const url = persistedUploadPublicUrl(req, file.path);
      if (!url) return;
      try {
        setByPath(recoveryProtocolObj, String(targets[i]).trim(), url);
      } catch (_) {
        /* ignore bad path key */
      }
    });
    return;
  }

  if (!recoveryProtocolObj.media_urls) recoveryProtocolObj.media_urls = [];
  files.forEach((file) => {
    if (!file?.path) return;
    const url = persistedUploadPublicUrl(req, file.path);
    if (url) recoveryProtocolObj.media_urls.push(url);
  });
};

/**
 * multipart field `library_media` (multiple files).
 * Required `library_media_targets` JSON array of dot-paths — same length & order
 * as files. Each dot-path points inside `exerciseLibrary`, e.g.:
 *   ["A.0.thumbnail_url","A.1.video_url","B.0.thumbnail_url","UPPER.0.thumbnail_url"]
 *
 * Files without a matching target are ignored (no implicit append because the
 * library is a nested object, not a flat array).
 */
const mergeLibraryMediaUploads = (req, exerciseLibraryObj) => {
  if (!exerciseLibraryObj || typeof exerciseLibraryObj !== 'object') return;
  const raw = req.files?.library_media;
  const files = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!files.length) return;

  let targets = null;
  try {
    const t = req.body?.library_media_targets;
    if (t != null && String(t).trim()) targets = JSON.parse(String(t));
  } catch (_) {
    targets = null;
  }
  if (!Array.isArray(targets) || !targets.length) return;

  files.forEach((file, i) => {
    if (!file?.path || !targets[i]) return;
    const url = persistedUploadPublicUrl(req, file.path);
    if (!url) return;
    const pathStr = String(targets[i]).trim();
    try {
      setByPath(exerciseLibraryObj, pathStr, url);
      mirrorLibraryMediaPath(exerciseLibraryObj, pathStr, url);
    } catch (_) {
      /* ignore bad path key */
    }
  });

  syncExerciseLibraryWorkoutAliases(exerciseLibraryObj);
};

/**
 * multipart `workout_meta_media` + `workout_meta_media_targets`, e.g. ["A.thumbnail_url"].
 * Merges into `workoutsMeta` (Workout A / B / C block thumbnails).
 */
const mergeWorkoutMetaMediaUploads = (req, workoutsMetaObj) => {
  if (!workoutsMetaObj || typeof workoutsMetaObj !== 'object') return;
  const raw = req.files?.workout_meta_media;
  const files = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!files.length) return;

  let targets = null;
  try {
    const t = req.body?.workout_meta_media_targets;
    if (t != null && String(t).trim()) targets = JSON.parse(String(t));
  } catch (_) {
    targets = null;
  }
  if (!Array.isArray(targets) || !targets.length) return;

  files.forEach((file, i) => {
    if (!file?.path || !targets[i]) return;
    const url = persistedUploadPublicUrl(req, file.path);
    if (!url) return;
    try {
      setByPath(workoutsMetaObj, String(targets[i]).trim(), url);
    } catch (_) {
      /* ignore bad path */
    }
  });
};

/**
 * Wipes browser-only `blob:` URLs from nested `thumbnail_url` / `video_url` /
 * `media_url` / `thumbnailUrl` / `videoUrl` / `mediaUrl` fields. These leak in
 * when admin frontend forgets to upload the actual file before submit.
 */
const stripBlobMediaUrls = (node) => {
  if (node == null) return node;
  if (Array.isArray(node)) {
    node.forEach((item) => stripBlobMediaUrls(item));
    return node;
  }
  if (typeof node !== 'object') return node;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && /^blob:/i.test(v.trim())) {
      node[k] = '';
    } else if (v && typeof v === 'object') {
      stripBlobMediaUrls(v);
    }
  }
  return node;
};

const rewriteProgramMediaUrlsForResponse = (req, program) => {
  if (!program) return program;
  const out =
    typeof program.toObject === 'function'
      ? program.toObject()
      : typeof program.toJSON === 'function'
        ? program.toJSON()
        : { ...program };

  if (out.videoPath && shouldRewriteMediaString(out.videoPath)) {
    out.videoPath = toPublicFileUrl(req, out.videoPath);
  }
  if (out.recoveryProtocol != null) {
    out.recoveryProtocol = remapMediaStringsInMixed(req, deepCloneJson(out.recoveryProtocol));
  }
  if (out.exerciseLibrary != null) {
    out.exerciseLibrary = remapMediaStringsInMixed(req, deepCloneJson(out.exerciseLibrary));
  }
  return out;
};

module.exports = {
  mergeRecoveryMediaUploads,
  mergeLibraryMediaUploads,
  mergeWorkoutMetaMediaUploads,
  syncExerciseLibraryWorkoutAliases,
  syncWorkoutsFromExerciseLibrary,
  rewriteProgramMediaUrlsForResponse,
  filePathToWebPath,
  stripBlobMediaUrls,
};
