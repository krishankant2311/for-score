const mongoose = require('mongoose');
const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Notification = require('../model/notificationModel');
const NotificationRead = require('../model/notificationReadModel');
const {
  sendOneSignalNotification,
  getOneSignalDeliveryError,
  collectInvalidIds,
  isOneSignalDeliveryOk,
} = require('../service/oneSignalService');

const dedupeMongoUserIds = (ids) => {
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

/** One subscription id per user — latest saved id (avoids stale entries in history). */
const pickSubscriptionId = (u) => {
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

  const ids = [];
  for (const u of users) {
    const subId = pickSubscriptionId(u);
    if (subId) ids.push(subId);
  }
  return ids;
};

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
    const before = (user.oneSignalPlayerIds || []).length;
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

const normalizeDeliveryMode = (raw) => {
  const v = String(raw ?? 'now').trim().toLowerCase();
  if (['draft', 'save_draft', 'save-draft'].includes(v)) return 'draft';
  if (['schedule', 'scheduled'].includes(v)) return 'schedule';
  return 'now';
};

const normalizeRecipientMode = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'all') return 'all';
  if (v === 'active') return 'active';
  if (v === 'custom') return 'custom';
  return 'custom';
};

const parseScheduledAt = (raw) => {
  if (raw == null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const resolveRecipients = async ({ sendToAll, playerIds, userIds: mongoUserIdsBody }) => {
  const toAll = toBool(sendToAll);
  const rawPlayerIds = normalizePlayerIds(playerIds);
  const { mongoUserIds: mongoFromPlayerField, oneSignalIds: directOneSignalIds } =
    splitRecipientIds(rawPlayerIds);
  const allMongoUserIds = [
    ...new Set([...normalizeMongoUserIds(mongoUserIdsBody), ...mongoFromPlayerField]),
  ];
  const idsFromUsers = await resolvePlayerIdsFromMongoUserIds(allMongoUserIds);
  const ids = [...new Set([...directOneSignalIds, ...idsFromUsers])];
  const targetUserIds = toAll ? [] : dedupeMongoUserIds(allMongoUserIds);
  return { toAll, allMongoUserIds, ids, targetUserIds };
};

const deliverNotificationPush = async ({
  title,
  message,
  data,
  toAll,
  allMongoUserIds,
  ids,
}) => {
  let onesignalResp = null;
  let deliveryOk = false;
  let deliveryError = null;

  try {
    onesignalResp = await sendOneSignalNotification({
      title: title.trim(),
      message: message.trim(),
      data: data && typeof data === 'object' ? data : {},
      playerIds: ids,
      sendToAll: toAll,
    });
    deliveryOk = isOneSignalDeliveryOk(onesignalResp);
    deliveryError = deliveryOk ? null : getOneSignalDeliveryError(onesignalResp);
  } catch (pushErr) {
    deliveryError = pushErr?.message || 'Failed to send push notification';
    onesignalResp = pushErr?.response || null;
    if (pushErr?.code === 'ONESIGNAL_ENV_MISSING') {
      deliveryError =
        'Push notifications are not configured on the server (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY).';
    }
  }

  const invalidIds = collectInvalidIds(onesignalResp?.errors);
  if (invalidIds.length) {
    await pruneInvalidSubscriptionIds(allMongoUserIds, invalidIds);
  }
  const invalidSet = new Set(invalidIds.map(String));
  const sentPlayerIds = toAll ? [] : ids.filter((id) => !invalidSet.has(String(id)));

  return { onesignalResp, deliveryOk, deliveryError, sentPlayerIds };
};

const deliverStoredNotification = async (doc) => {
  const toAll = doc.target === 'All';
  const allMongoUserIds = (doc.userIds || []).map((id) => String(id));
  const idsFromUsers = await resolvePlayerIdsFromMongoUserIds(allMongoUserIds);
  const ids = [...new Set(idsFromUsers)];

  if (!toAll && allMongoUserIds.length && !idsFromUsers.length) {
    return {
      deliveryOk: false,
      deliveryError:
        'Selected user(s) have no OneSignal subscription id. Ask them to open the app and allow notifications.',
      onesignalResp: null,
      sentPlayerIds: [],
    };
  }

  if (!toAll && !ids.length) {
    return {
      deliveryOk: false,
      deliveryError:
        'No recipients with a saved push subscription. Configure sendToAll or valid userIds.',
      onesignalResp: null,
      sentPlayerIds: [],
    };
  }

  return deliverNotificationPush({
    title: doc.title,
    message: doc.message,
    data: doc.data,
    toAll,
    allMongoUserIds,
    ids,
  });
};

const processDueScheduledNotifications = async () => {
  const due = await Notification.find({
    status: 'Scheduled',
    scheduledAt: { $lte: new Date() },
  })
    .sort({ scheduledAt: 1 })
    .limit(25);

  for (const doc of due) {
    const { onesignalResp, deliveryOk, deliveryError, sentPlayerIds } =
      await deliverStoredNotification(doc);

    await Notification.findByIdAndUpdate(doc._id, {
      $set: {
        status: deliveryOk ? 'Sent' : 'Failed',
        error: deliveryError || '',
        'onesignal.notificationId': onesignalResp?.id || '',
        'onesignal.playerIds': doc.target === 'All' ? [] : deliveryOk ? sentPlayerIds : [],
        'onesignal.deliveryMethod': onesignalResp?._deliveryMethod || '',
        'onesignal.raw': onesignalResp || {},
      },
    });
  }
};

// ---------------- Admin ----------------

// POST /api/admin/send-notification
// Body:
// - title (required)
// - message (required)
// - sendToAll (boolean) OR playerIds / userIds
// - deliveryMode: now | schedule | draft (default now)
// - scheduledAt (required when deliveryMode=schedule)
// - type, recipientMode (optional)
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
      data,
      deliveryMode: deliveryModeBody,
      action,
      scheduledAt: scheduledAtBody,
      type,
      recipientMode: recipientModeBody,
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required',
      });
    }

    const deliveryMode = normalizeDeliveryMode(deliveryModeBody ?? action);
    const recipientMode = normalizeRecipientMode(recipientModeBody);
    const notificationType = String(type ?? 'General').trim() || 'General';

    const { toAll, allMongoUserIds, ids, targetUserIds } = await resolveRecipients({
      sendToAll,
      playerIds,
      userIds: mongoUserIdsBody,
    });

    if (!toAll && !targetUserIds.length && !ids.length) {
      return res.status(400).json({
        success: false,
        message: 'sendToAll=true or at least one userId / playerId is required',
      });
    }

    const baseDoc = {
      title: title.trim(),
      message: message.trim(),
      data: data && typeof data === 'object' ? data : {},
      target: toAll ? 'All' : 'Users',
      userIds: targetUserIds,
      type: notificationType,
      recipientMode,
      createdByAdminId: admin._id,
    };

    if (deliveryMode === 'draft') {
      const doc = await Notification.create({
        ...baseDoc,
        status: 'Draft',
        scheduledAt: null,
        error: '',
        onesignal: {
          notificationId: '',
          playerIds: [],
          deliveryMethod: '',
          raw: {},
        },
      });
      return res.json({
        success: true,
        message: 'Notification saved as draft',
        result: doc,
      });
    }

    if (deliveryMode === 'schedule') {
      const scheduledAt = parseScheduledAt(scheduledAtBody);
      if (!scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'scheduledAt is required for scheduled notifications',
        });
      }
      if (scheduledAt.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'scheduledAt must be a future date and time',
        });
      }

      const doc = await Notification.create({
        ...baseDoc,
        status: 'Scheduled',
        scheduledAt,
        error: '',
        onesignal: {
          notificationId: '',
          playerIds: [],
          deliveryMethod: '',
          raw: {},
        },
      });
      return res.json({
        success: true,
        message: 'Notification scheduled successfully',
        result: doc,
      });
    }

    if (!toAll && allMongoUserIds.length && !ids.length) {
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

    const { onesignalResp, deliveryOk, deliveryError, sentPlayerIds } =
      await deliverNotificationPush({
        title,
        message,
        data,
        toAll,
        allMongoUserIds,
        ids,
      });

    const doc = await Notification.create({
      ...baseDoc,
      scheduledAt: null,
      onesignal: {
        notificationId: onesignalResp?.id || '',
        playerIds: toAll ? [] : deliveryOk ? sentPlayerIds : ids,
        deliveryMethod: onesignalResp?._deliveryMethod || '',
        raw: onesignalResp || {},
      },
      status: deliveryOk ? 'Sent' : 'Failed',
      error: deliveryError || '',
    });

    if (!deliveryOk) {
      const statusCode =
        deliveryError && deliveryError.includes('not configured on the server') ? 503 : 502;
      return res.status(statusCode).json({
        success: false,
        message:
          toAll && statusCode === 503
            ? 'Cannot send to all users: push service is not configured on the server'
            : 'Push notification was not delivered by OneSignal',
        error: deliveryError,
        result: doc,
        onesignal: onesignalResp,
        hint:
          toAll
            ? 'Verify ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY on the server, and that your OneSignal app has an "All" or "Subscribed Users" segment.'
            : 'Check Render env ONESIGNAL_APP_ID matches mobile app. In OneSignal → Audience → Subscriptions, copy Subscription ID (not User ID). Re-save via POST /api/user/profile/player-id from the app.',
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

    await processDueScheduledNotifications();

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

const userNotificationQuery = (userId) => ({
  status: 'Sent',
  $or: [{ target: 'All' }, { target: 'Users', userIds: userId }],
});

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

    const query = userNotificationQuery(user._id);

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

// POST /api/user/notifications/read-all
const markAllNotificationsRead = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const notifications = await Notification.find(userNotificationQuery(user._id))
      .select('_id')
      .lean();

    if (!notifications.length) {
      return res.json({
        success: true,
        message: 'No notifications to mark as read',
        result: { markedCount: 0, alreadyReadCount: 0, total: 0 },
      });
    }

    const notificationIds = notifications.map((n) => n._id);
    const now = new Date();

    const bulkResult = await NotificationRead.bulkWrite(
      notificationIds.map((notificationId) => ({
        updateOne: {
          filter: { userId: user._id, notificationId },
          update: { $setOnInsert: { readAt: now } },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    const markedCount = bulkResult.upsertedCount || 0;

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      result: {
        markedCount,
        alreadyReadCount: notificationIds.length - markedCount,
        total: notificationIds.length,
      },
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
  markAllNotificationsRead,
  markNotificationRead,
};

