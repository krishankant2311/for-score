const { Admin } = require('../model/adminModel');
const StretchProgram = require('../model/stretchProgramModel');

const LEVELS = ['Beginner', 'Intermediate', 'All Levels'];
const STATUSES = ['Active', 'Draft', 'Deleted'];

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const slugIconKey = (title) =>
  String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'stretch_default';

const parseMovements = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m, idx) => ({
      sequenceOrder: Number(m.sequenceOrder ?? m.sequence ?? idx + 1),
      sequenceLabel: String(m.sequenceLabel ?? m.label ?? '').trim(),
      movementName: String(m.movementName ?? m.movement ?? m.name ?? '').trim(),
      targetArea: String(m.targetArea ?? m.target ?? '').trim(),
      timeLabel: String(m.timeLabel ?? m.time ?? '').trim(),
    }))
    .filter((m) => m.movementName);
};

const normalizeLevel = (raw) => {
  const v = String(raw ?? 'All Levels').trim();
  return LEVELS.includes(v) ? v : 'All Levels';
};

const normalizeStatus = (raw) => {
  const v = String(raw ?? 'Active').trim();
  return STATUSES.includes(v) ? v : 'Active';
};

const buildProgramPayload = (body) => {
  const title = String(body.title ?? '').trim();
  const intro = String(body.intro ?? '').trim();
  const description = String(body.description ?? intro).trim().slice(0, 500);
  const movements = parseMovements(body.movements);
  const durationMinutes = Number(body.durationMinutes);
  const stretchCount = movements.length || Number(body.stretchCount) || 0;

  return {
    title,
    intro,
    description: description || title,
    category: String(body.category ?? 'Recover').trim() || 'Recover',
    level: normalizeLevel(body.level),
    durationMinutes,
    stretchCount: stretchCount > 0 ? stretchCount : movements.length,
    movements,
    iconKey: String(body.iconKey ?? '').trim() || slugIconKey(title),
    mediaPath: String(body.mediaPath ?? '').trim(),
    sortOrder: body.sortOrder != null && body.sortOrder !== '' ? Number(body.sortOrder) : 0,
    status: normalizeStatus(body.status),
  };
};

const validatePayload = (payload) => {
  if (!payload.title) return 'title is required';
  if (!payload.description) return 'description is required';
  if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes < 1) {
    return 'durationMinutes must be at least 1';
  }
  if (!payload.movements.length) return 'At least one movement is required';
  return null;
};

const addStretchProgram = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Admin not found or inactive' });
    }

    const payload = buildProgramPayload(req.body);
    const err = validatePayload(payload);
    if (err) return res.status(400).json({ success: false, message: err });

    payload.stretchCount = payload.movements.length;

    const doc = await StretchProgram.create(payload);
    return res.json({
      success: true,
      message: 'Stretch program added successfully',
      result: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

const getAllStretchProgramsAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Admin not found or inactive' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const search = String(req.query.search ?? '').trim();
    const statusFilter = String(req.query.status ?? 'active').toLowerCase();

    const query = {};
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'draft') query.status = 'Draft';
    else if (statusFilter === 'deleted') query.status = 'Deleted';
    else query.status = { $ne: 'Deleted' };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { intro: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      StretchProgram.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      StretchProgram.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Stretch programs fetched successfully',
      result: { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

const getStretchProgramByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Admin not found or inactive' });
    }

    const doc = await StretchProgram.findById(req.params.id).lean();
    if (!doc || doc.status === 'Deleted') {
      return res.status(404).json({ success: false, message: 'Stretch program not found' });
    }

    return res.json({
      success: true,
      message: 'Stretch program fetched successfully',
      result: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

const updateStretchProgram = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Admin not found or inactive' });
    }

    const doc = await StretchProgram.findById(req.params.id);
    if (!doc || doc.status === 'Deleted') {
      return res.status(404).json({ success: false, message: 'Stretch program not found' });
    }

    const payload = buildProgramPayload(req.body);
    const err = validatePayload(payload);
    if (err) return res.status(400).json({ success: false, message: err });

    payload.stretchCount = payload.movements.length;
    Object.assign(doc, payload);
    await doc.save();

    return res.json({
      success: true,
      message: 'Stretch program updated successfully',
      result: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

const deleteStretchProgram = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({ success: false, message: 'Admin not found or inactive' });
    }

    const doc = await StretchProgram.findById(req.params.id);
    if (!doc || doc.status === 'Deleted') {
      return res.status(404).json({ success: false, message: 'Stretch program not found' });
    }

    doc.status = 'Deleted';
    await doc.save();

    return res.json({
      success: true,
      message: 'Stretch program deleted successfully',
      result: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

module.exports = {
  addStretchProgram,
  getAllStretchProgramsAdmin,
  getStretchProgramByIdAdmin,
  updateStretchProgram,
  deleteStretchProgram,
};
