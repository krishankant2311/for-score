const { toPublicFileUrl } = require('./publicFileUrl');

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
      const rel = filePathToWebPath(file.path);
      if (!rel) return;
      try {
        setByPath(recoveryProtocolObj, String(targets[i]).trim(), rel);
      } catch (_) {
        /* ignore bad path key */
      }
    });
    return;
  }

  if (!recoveryProtocolObj.media_urls) recoveryProtocolObj.media_urls = [];
  files.forEach((file) => {
    if (!file?.path) return;
    const rel = filePathToWebPath(file.path);
    if (rel) recoveryProtocolObj.media_urls.push(rel);
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
    const rel = filePathToWebPath(file.path);
    if (!rel) return;
    try {
      setByPath(exerciseLibraryObj, String(targets[i]).trim(), rel);
    } catch (_) {
      /* ignore bad path key */
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
  rewriteProgramMediaUrlsForResponse,
  filePathToWebPath,
  stripBlobMediaUrls,
};
