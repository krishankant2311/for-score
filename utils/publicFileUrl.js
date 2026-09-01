const buildPublicBaseUrl = (req) =>
  process.env.PUBLIC_BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;

/** Normalize stored paths to a web path under /uploads/... (or null if not our upload asset). */
const extractUploadsWebPath = (storedPath) => {
  const raw = String(storedPath).trim().replace(/\\/g, '/');
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const pathname = new URL(raw).pathname.replace(/\\/g, '/');
      const idx = pathname.toLowerCase().indexOf('/uploads/');
      return idx >= 0 ? pathname.slice(idx) : null;
    } catch (_) {
      return null;
    }
  }

  const lower = raw.toLowerCase();
  const uploadsIdx = lower.lastIndexOf('/uploads/');
  if (uploadsIdx >= 0) return raw.slice(uploadsIdx);

  const inlineUploads = lower.indexOf('uploads/');
  if (inlineUploads >= 0) {
    return `/${raw.slice(inlineUploads).replace(/^\/+/, '')}`;
  }

  if (!raw.includes('/')) return `/uploads/${raw}`;

  if (raw.startsWith('/')) return raw;

  return `/${raw.replace(/^\/+/, '')}`;
};

/** API responses: return /uploads/... only (app prepends API base). YouTube/CDN URLs unchanged. */
const toUploadsWebPath = (storedPath) => {
  if (!storedPath) return '';
  const raw = String(storedPath).trim();
  if (!raw) return '';
  const uploadsPath = extractUploadsWebPath(raw);
  if (uploadsPath) return uploadsPath;
  return raw;
};

const toPublicFileUrl = (req, storedPath) => {
  if (!storedPath) return '';
  const raw = String(storedPath).trim();
  if (!raw) return '';

  // External URLs (YouTube, etc.) — unchanged unless they point at our /uploads/ (legacy Render host).
  if (/^https?:\/\//i.test(raw)) {
    const uploadsPath = extractUploadsWebPath(raw);
    if (!uploadsPath) return raw;
    return `${buildPublicBaseUrl(req)}${uploadsPath}`;
  }

  const uploadsPath = extractUploadsWebPath(raw);
  if (!uploadsPath) return raw;
  return `${buildPublicBaseUrl(req)}${uploadsPath}`;
};

module.exports = { buildPublicBaseUrl, extractUploadsWebPath, toUploadsWebPath, toPublicFileUrl };
