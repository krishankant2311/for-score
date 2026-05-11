const buildPublicBaseUrl = (req) =>
  process.env.PUBLIC_BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;

const toPublicFileUrl = (req, storedPath) => {
  if (!storedPath) return '';
  const raw = String(storedPath).trim();
  if (!raw || /^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/');
  const uploadsMarker = '/uploads/';
  const idx = normalized.toLowerCase().lastIndexOf(uploadsMarker);
  const publicPath = idx >= 0 ? normalized.slice(idx) : '';
  if (!publicPath) return '';
  return `${buildPublicBaseUrl(req)}${publicPath}`;
};

module.exports = { buildPublicBaseUrl, toPublicFileUrl };
