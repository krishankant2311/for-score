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
  rewriteProgramMediaUrlsForResponse,
  filePathToWebPath,
};
