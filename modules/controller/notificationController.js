const mongoose = require('mongoose');
const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Notification = require('../model/notificationModel');
const NotificationRead = require('../model/notificationReadModel');
const {
  sendOneSignalNotification,
  getOneSignalDeliveryError,
  collectInvalidIds,
} = require('../service/oneSignalService');

const normalizeRecipientMode = (raw, { toAll, mongoCount }) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (toAll || v === 'all') return 'all';
  if (v === 'active' || v === 'activeusers' || v === 'active_users') return 'active';
  if (v === 'custom' || v === 'selected') return 'custom';
  return mongoCount > 0 ? 'custom' : 'all';
};

/** Dedupe Mongo ids (string vs ObjectId) for storage and display. */
const toObjectIdList = (ids) => {
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  return unique
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

const toBool = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return Boolean(value);
};

const normalizePlayerIds = (playerIds) => {
  if (playerIds === undefined || playerIds === null || playerIds === '') return [];
  if (Array.isArray(playerIds)) {
    return playerIds.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const raw = String(playerIds).trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch (_) {
      /* fall through */
    }
  }
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [raw];
};

const resolveUserIdsByPlayerIds = async (playerIds) => {
  if (!playerIds.length) return [];

  const users = await User.find({
    status: { $ne: 'Deleted' },
    $or: [
      { oneSignalPlayerId: { $in: playerIds } },
      { oneSignalPlayerIds: { $in: playerIds } },
    ],
  })
    .select('_id')
    .lean();

  return users.map((u) => u._id);
};

const normalizeMongoUserIds = (userIds) => {
  if (userIds === undefined || userIds === null || userIds === '') return [];
  if (Array.isArray(userIds)) {
    return userIds.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const raw = String(userIds).trim();
  if (!raw) return [];
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [raw];
};

const isMongoObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id).trim());

/** Admin panel sends Mongo _id in playerIds — split from real OneSignal UUIDs. */
const splitRecipientIds = (ids) => {
  const mongoUserIds = [];
  const oneSignalIds = [];
  for (const id of ids) {
    const s = String(id).trim();
    if (!s) continue;
    if (isMongoObjectId(s)) mongoUserIds.push(s);
    else oneSignalIds.push(s);
  }
  return { mongoUserIds, oneSignalIds };
};

/** Latest subscription id per user (last app login wins). */
const pickCurrentSubscriptionId = (u) => {
  const history = (u?.oneSignalPlayerIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (history.length) return history[history.length - 1];
  return u?.oneSignalPlayerId ? String(u.oneSignalPlayerId).trim() : '';
};

/** Resolve OneSignal ids from Mongo user _id list (admin can pass userIds instead of playerIds). */
const resolvePlayerIdsFromMongoUserIds = async (mongoUserIds) => {
  if (!mongoUserIds.length) return [];

  const users = await User.find({
    _id: { $in: mongoUserIds },
    status: { $ne: 'Deleted' },
  })
    .select('oneSignalPlayerId oneSignalPlayerIds')
    .lean();

  const ids = new Set();
  for (const u of users) {
    const subId = pickCurrentSubscriptionId(u);
    if (subId) ids.add(subId);
  }
  return [...ids];
};

/** Remove invalid subscription ids from user records after OneSignal rejects them. */
const pruneInvalidSubscriptionIds = async (mongoUserIds, invalidIds) => {
  const invalid = new Set(
    (invalidIds || []).map((id) => String(id).trim()).filter(Boolean)
  );
  if (!invalid.size || !mongoUserIds.length) return;

  const users = await User.find({
    _id: { $in: mongoUserIds },
    status: { $ne: 'Deleted' },
  });

  for (const user of users) {
    let changed = false;
    if (user.oneSignalPlayerId && invalid.has(String(user.oneSignalPlayerId).trim())) {
      user.oneSignalPlayerId = '';
      changed = true;
    }
    const before = Array.isArray(user.oneSignalPlayerIds) ? user.oneSignalPlayerIds.length : 0;
    user.oneSignalPlayerIds = (user.oneSignalPlayerIds || [])
      .map((id) => String(id).trim())
      .filter((id) => id && !invalid.has(id));
    if (user.oneSignalPlayerIds.length !== before) changed = true;
    if (!user.oneSignalPlayerId && user.oneSignalPlayerIds.length) {
      user.oneSignalPlayerId = user.oneSignalPlayerIds[user.oneSignalPlayerIds.length - 1];
      changed = true;
    }
    if (changed) await user.save();
  }
};

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const getValidUser = async (token) => {
  const user_id = token?._id;
  if (!user_id) return null;
  const user = await User.findById(user_id);
  if (!user || user.status === 'Deleted') return null;
  return user;
};

// ---------------- Admin ----------------

// POST /api/admin/send-notification
// Body:
// - title (required)
// - message (required)
// - sendToAll (boolean) OR playerIds (array of OneSignal player_id)
// - data (object, optional)
const sendNotificationByAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const {
      title,
      message,
      sendToAll,
      playerIds,
      userIds: mongoUserIdsBody,
      recipientMode: recipientModeBody,
      data,
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const toAll = toBool(sendToAll);
    const rawPlayerIds = normalizePlayerIds(playerIds);
    const { mongoUserIds: mongoFromPlayerField, oneSignalIds: directOneSignalIds } =
      splitRecipientIds(rawPlayerIds);
    const allMongoUserIds = [
      ...new Set([
        ...normalizeMongoUserIds(mongoUserIdsBody),
        ...mongoFromPlayerField,
      ]),
    ];
    const idsFromUsers = await resolvePlayerIdsFromMongoUserIds(allMongoUserIds);
    const ids = [...new Set([...directOneSignalIds, ...idsFromUsers])];

    if (!toAll && allMongoUserIds.length && !idsFromUsers.length) {
      return res.status(400).json({
        success: false,
        message:
          'Selected user(s) have no OneSignal subscription id. Ask them to open the app and allow notifications.',
        userIds: allMongoUserIds,
      });
    }

    if (!toAll && !ids.length) {
      return res.status(400).json({
        success: false,
        message:
          'sendToAll=true or playerIds (OneSignal UUID) / userIds (Mongo _id) with saved subscription is required',
      });
    }

    const onesignalResp = await sendOneSignalNotification({
      title: title.trim(),
      message: message.trim(),
      data: data && typeof data === 'object' ? data : {},
      playerIds: ids,
      sendToAll: toAll,
    });

    const invalidIds = collectInvalidIds(onesignalResp?.errors);
    if (invalidIds.length) {
      await pruneInvalidSubscriptionIds(allMongoUserIds, invalidIds);
    }

    const deliveryError = getOneSignalDeliveryError(onesignalResp);
    const deliveredIds = toAll
      ? []
      : onesignalResp?._skippedInvalidIds
        ? ids.filter((id) => !onesignalResp._skippedInvalidIds.includes(String(id)))
        : ids;
    // Store only admin-selected Mongo user ids (not OneSignal reverse-lookup duplicates).
    const targetUserIds = toAll ? [] : toObjectIdList(allMongoUserIds);
    const recipientMode = normalizeRecipientMode(recipientModeBody, {
      toAll,
      mongoCount: targetUserIds.length,
    });

    const doc = await Notification.create({
      title: title.trim(),
      message: message.trim(),
      data: data && typeof data === 'object' ? data : {},
      target: toAll ? 'All' : 'Users',
      recipientMode,
      userIds: targetUserIds,
      onesignal: {
        notificationId: onesignalResp?.id || '',
        playerIds: toAll ? [] : deliveredIds.length ? deliveredIds : ids,
        deliveryMethod: onesignalResp?._deliveryMethod || '',
        raw: onesignalResp || {},
      },
      status: deliveryError ? 'Failed' : 'Sent',
      error: deliveryError || '',
      createdByAdminId: admin._id,
    });

    if (deliveryError) {
      return res.status(502).json({
        success: false,
        message: 'Push notification was not delivered by OneSignal',
        error: deliveryError,
        result: doc,
        onesignal: onesignalResp,
        hint:
          'Check Render env ONESIGNAL_APP_ID matches mobile app. In OneSignal → Audience → Subscriptions, copy Subscription ID (not User ID). Re-save via POST /api/user/profile/player-id from the app.',
      });
    }

    return res.json({
      success: true,
      message: 'Notification sent successfully',
      result: doc,
      onesignal: onesignalResp,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: err.message,
      details: err.response || undefined,
    });
  }
};

// GET /api/admin/get-all-notifications
const getAllNotificationsAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({}),
    ]);

    return res.json({
      success: true,
      message: 'Notifications fetched successfully',
      result: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
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

// ---------------- User ----------------

// GET /api/user/notifications
const getNotificationsForUser = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {
      status: 'Sent',
      $or: [{ target: 'All' }, { target: 'Users', userIds: user._id }],
    };

    const [items, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    const notificationIds = items.map((n) => n._id);
    const reads = await NotificationRead.find({
      userId: user._id,
      notificationId: { $in: notificationIds },
    })
      .select('notificationId readAt')
      .lean();

    const readMap = new Map(reads.map((r) => [String(r.notificationId), r.readAt]));
    const resultItems = items.map((n) => ({
      ...n,
      isRead: readMap.has(String(n._id)),
      readAt: readMap.get(String(n._id)) || null,
    }));

    return res.json({
      success: true,
      message: 'Notifications fetched successfully',
      result: { items: resultItems, total, page, limit, totalPages: Math.ceil(total / limit) },
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

// POST /api/user/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const { id } = req.params;
    const notif = await Notification.findById(id).select('_id target userIds status').lean();
    if (!notif || notif.status !== 'Sent') {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    const allowed =
      notif.target === 'All' ||
      (Array.isArray(notif.userIds) &&
        notif.userIds.some((uid) => String(uid) === String(user._id)));

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    const read = await NotificationRead.findOneAndUpdate(
      { userId: user._id, notificationId: notif._id },
      { $setOnInsert: { readAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      success: true,
      message: 'Notification marked as read',
      result: read,
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
  sendNotificationByAdmin,
  getAllNotificationsAdmin,
  getNotificationsForUser,
  markNotificationRead,
};

