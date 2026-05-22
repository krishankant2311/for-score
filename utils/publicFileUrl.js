const buildPublicBaseUrl = (req) =>
  process.env.PUBLIC_BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;

const toPublicFileUrl = (req, storedPath) => {
  if (!storedPath) return '';
  const raw = String(storedPath).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = buildPublicBaseUrl(req);
  const normalized = raw.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();

  const uploadsIdx = lower.lastIndexOf('/uploads/');
  if (uploadsIdx >= 0) {
    return `${base}${normalized.slice(uploadsIdx)}`;
  }

  const inlineUploads = lower.indexOf('uploads/');
  if (inlineUploads >= 0) {
    const slice = normalized.slice(inlineUploads);
    return `${base}/${slice.replace(/^\/+/, '')}`;
  }

  // Multer often stores only the filename under uploads/
  if (!normalized.includes('/')) {
    return `${base}/uploads/${normalized}`;
  }

  if (normalized.startsWith('/')) {
    return `${base}${normalized}`;
  }

  return `${base}/${normalized}`;
};

module.exports = { buildPublicBaseUrl, toPublicFileUrl };
