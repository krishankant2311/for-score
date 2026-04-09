const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const WorkoutLog = require('../model/workoutLogModel');
const MealLog = require('../model/mealLogModel');
const Exercise = require('../model/exerciseModel');
const NutritionItem = require('../model/nutritionItemModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

// --------- Date helpers (UTC aligned to frontend contract) ---------
const startOfDayUTC = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));

const addDaysUTC = (d, days) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
};

const startOfMonthUTC = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));

const addMonthsUTC = (d, months) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
};

const toYMD = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const safePercent = (num, den) =>
  den > 0 ? Math.round((num / den) * 100) : null;

// Frontend contract timeframe: all | last_week | last_3_months | today
const resolveRange = (timeframeRaw) => {
  const tf = String(timeframeRaw || 'today').toLowerCase();
  const now = new Date();
  const todayFrom = startOfDayUTC(now);
  const todayTo = addDaysUTC(todayFrom, 1);

  if (tf === 'all') return { timeframe: 'all', from: null, to: null };
  if (tf === 'last_week') {
    const from = addDaysUTC(todayFrom, -7);
    return { timeframe: 'last_week', from, to: todayTo };
  }
  if (tf === 'last_3_months') {
    const from = startOfDayUTC(addMonthsUTC(now, -3));
    return { timeframe: 'last_3_months', from, to: todayTo };
  }
  return { timeframe: 'today', from: todayFrom, to: todayTo };
};

const dateMatch = (field, from, to) => {
  if (!from || !to) return {};
  return { [field]: { $gte: from, $lt: to } };
};

// GET /api/admin/dashboard?timeframe=today|7d|30d
const getAdminDashboard = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    // Back-compat: old query param was `timeframe=today|7d|30d`.
    // New contract: `timeframe=all|last_week|last_3_months|today`.
    const incomingTf = req.query.timeframe || req.query.timeframe;
    const mappedTf = (() => {
      const tf = String(incomingTf || '').toLowerCase();
      if (tf === '7d') return 'last_week';
      if (tf === '30d') return 'last_3_months';
      if (!tf) return 'today';
      return tf;
    })();

    const { timeframe, from, to } = resolveRange(mappedTf);

    // Charts: users chart fixed 6 months; nutrition chart follows timeframe
    const now = new Date();
    const chartsUsersFrom = startOfMonthUTC(addMonthsUTC(now, -5));
    const chartsUsersTo = addDaysUTC(startOfDayUTC(now), 1);
    const nutritionChartEnd = to || chartsUsersTo;
    const nutritionDays =
      timeframe === 'last_3_months'
        ? Math.min(
            92,
            Math.max(
              7,
              Math.round((nutritionChartEnd.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
            )
          )
        : 7;
    const nutritionChartStart =
      timeframe === 'last_3_months' && from
        ? from
        : addDaysUTC(nutritionChartEnd, -nutritionDays);

    // Cards
    const totalUsersPromise = User.countDocuments({});
    const totalActiveUsersPromise = User.countDocuments({ status: 'Active' });
    const activeTodayPromise = User.countDocuments({
      ...dateMatch('createdAt', from, to),
      status: 'Active',
    });
    const exercisesTodayPromise = WorkoutLog.countDocuments({
      status: 'Active',
      ...dateMatch('date', from, to),
    });
    const nutritionLogsTodayPromise = MealLog.countDocuments({
      status: 'Active',
      ...dateMatch('date', from, to),
    });
    const totalNutritionItemsPromise = NutritionItem.countDocuments({ status: 'Active' });
    const nutritionItemsAddedInRangePromise = NutritionItem.countDocuments({
      status: 'Active',
      ...dateMatch('createdAt', from, to),
    });

    // Users delta (previous period) based on createdAt
    let usersDelta = null;
    let usersDeltaPercent = null;
    if (from && to) {
      const rangeMs = to.getTime() - from.getTime();
      const prevFrom = new Date(from.getTime() - rangeMs);
      const prevTo = new Date(to.getTime() - rangeMs);
      const [currUsers, prevUsers] = await Promise.all([
        User.countDocuments(dateMatch('createdAt', from, to)),
        User.countDocuments(dateMatch('createdAt', prevFrom, prevTo)),
      ]);
      usersDelta = currUsers - prevUsers;
      usersDeltaPercent = prevUsers > 0 ? safePercent(usersDelta, prevUsers) : null;
    }

    const [
      totalUsers,
      totalActiveUsers,
      activeToday,
      exercisesToday,
      nutritionLogsToday,
      totalNutritionItems,
      nutritionItemsAddedInRange,
    ] =
      await Promise.all([
        totalUsersPromise,
        totalActiveUsersPromise,
        activeTodayPromise,
        exercisesTodayPromise,
        nutritionLogsTodayPromise,
        totalNutritionItemsPromise,
        nutritionItemsAddedInRangePromise,
      ]);

    // ---------- Charts ----------
    const usersCreatedByMonth = await User.aggregate([
      { $match: { createdAt: { $gte: chartsUsersFrom, $lt: chartsUsersTo } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.y' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.m', 10] },
                  { $concat: ['0', { $toString: '$_id.m' }] },
                  { $toString: '$_id.m' },
                ],
              },
            ],
          },
          count: 1,
        },
      },
    ]);

    // Monthly active users derived from WorkoutLog+MealLog distinct users per month (uses `date`)
    const logsForMonthlyActive = await Promise.all([
      WorkoutLog.find({ status: 'Active', date: { $gte: chartsUsersFrom, $lt: chartsUsersTo } })
        .select('userId date')
        .lean(),
      MealLog.find({ status: 'Active', date: { $gte: chartsUsersFrom, $lt: chartsUsersTo } })
        .select('userId date')
        .lean(),
    ]);
    const monthlyMap = new Map(); // YYYY-MM -> Set(userId)
    const pushMonthly = (userId, date) => {
      const d = new Date(date);
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(ym)) monthlyMap.set(ym, new Set());
      monthlyMap.get(ym).add(String(userId));
    };
    for (const w of logsForMonthlyActive[0]) pushMonthly(w.userId, w.date);
    for (const m of logsForMonthlyActive[1]) pushMonthly(m.userId, m.date);
    const monthlyActiveUsers = Array.from(monthlyMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([month, set]) => ({ month, count: set.size }));

    // Nutrition logs by day (timeframe-based, fill zeros)
    const nutritionRaw = await MealLog.aggregate([
      { $match: { status: 'Active', ...dateMatch('date', nutritionChartStart, nutritionChartEnd) } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' }, d: { $dayOfMonth: '$date' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]);
    const nutritionMap = new Map();
    for (const r of nutritionRaw) {
      const d = new Date(Date.UTC(r._id.y, r._id.m - 1, r._id.d));
      nutritionMap.set(toYMD(d), r.count);
    }
    const nutritionLogsByDay = Array.from({ length: nutritionDays }).map((_, i) => {
      const d = addDaysUTC(nutritionChartStart, i);
      const keyDay = toYMD(d);
      return { day: keyDay, count: nutritionMap.get(keyDay) ?? 0 };
    });

    // ---------- Donuts ----------
    const userStatus = await User.aggregate([
      ...(from && to ? [{ $match: dateMatch('createdAt', from, to) }] : []),
      { $group: { _id: { $ifNull: ['$status', 'Active'] }, value: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { label: 1 } },
    ]);

    const exerciseTypesThisWeek = await WorkoutLog.aggregate([
      ...(from && to
        ? [{ $match: { status: 'Active', ...dateMatch('date', from, to) } }]
        : [{ $match: { status: 'Active' } }]),
      {
        $lookup: {
          from: Exercise.collection.name,
          localField: 'exerciseName',
          foreignField: 'title',
          as: 'exerciseDoc',
        },
      },
      {
        $addFields: {
          type: { $ifNull: [{ $arrayElemAt: ['$exerciseDoc.category', 0] }, 'Other'] },
        },
      },
      { $group: { _id: '$type', value: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } },
    ]);

    const nutritionLogsThisWeek = await MealLog.aggregate([
      ...(from && to
        ? [{ $match: { status: 'Active', ...dateMatch('date', from, to) } }]
        : [{ $match: { status: 'Active' } }]),
      { $group: { _id: { $ifNull: ['$mealType', 'Other'] }, value: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } },
    ]);

    // Nutrition logging status (computed): per active user per day in range
    const nutritionLoggingStatus = await (async () => {
      if (!from || !to) {
        return [
          { label: 'On track', value: 0 },
          { label: 'Partial', value: 0 },
          { label: 'Missed', value: 0 },
        ];
      }
      const totalActiveUsers = await User.countDocuments({ status: 'Active' });
      const totalDays = Math.max(
        1,
        Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
      );
      const perUserDay = await MealLog.aggregate([
        { $match: { status: 'Active', ...dateMatch('date', from, to) } },
        { $group: { _id: { userId: '$userId', day: '$date' }, mealTypes: { $addToSet: '$mealType' } } },
        { $project: { mealCount: { $size: '$mealTypes' } } },
      ]);
      let onTrack = 0;
      let partial = 0;
      for (const r of perUserDay) {
        const c = r.mealCount || 0;
        if (c >= 3) onTrack += 1;
        else if (c >= 1) partial += 1;
      }
      const logged = perUserDay.length;
      const totalSlots = totalActiveUsers * totalDays;
      const missed = Math.max(0, totalSlots - logged);
      return [
        { label: 'On track', value: onTrack },
        { label: 'Partial', value: partial },
        { label: 'Missed', value: missed },
      ];
    })();

    const exerciseLibraryCategories = await Exercise.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: { $ifNull: ['$category', 'Other'] }, value: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', value: 1 } },
      { $sort: { value: -1 } },
    ]);

    // ---------- Tables ----------
    const topFoodsThisWeek = await MealLog.aggregate([
      ...(from && to
        ? [{ $match: { status: 'Active', ...dateMatch('date', from, to) } }]
        : [{ $match: { status: 'Active' } }]),
      { $unwind: '$items' },
      { $group: { _id: '$items.name', calories: { $sum: '$items.calories' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, foodName: '$_id', calories: 1, count: 1 } },
    ]);

    const topExercisesFromLogs = await WorkoutLog.aggregate([
      ...(from && to
        ? [{ $match: { status: 'Active', ...dateMatch('date', from, to) } }]
        : [{ $match: { status: 'Active' } }]),
      { $group: { _id: '$exerciseName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, exerciseName: '$_id', count: 1 } },
    ]);
    const topExercisesThisWeek =
      topExercisesFromLogs && topExercisesFromLogs.length
        ? topExercisesFromLogs
        : (await Exercise.find({ status: 'Active' })
            .select('title')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()).map((e) => ({ exerciseName: e.title || 'Exercise', count: 0 }));

    // ---------- Recent activity ----------
    const [recentUsers, recentWorkouts, recentMeals] = await Promise.all([
      User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id name email status createdAt')
        .lean(),
      WorkoutLog.find({
        status: 'Active',
        ...dateMatch('date', from, to),
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id userId exerciseName date createdAt')
        .lean(),
      MealLog.find({
        status: 'Active',
        ...dateMatch('date', from, to),
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id userId mealType date createdAt')
        .lean(),
    ]);

    return res.json({
      success: true,
      message: 'Dashboard data fetched successfully',
      result: {
        timeframe,
        range: {
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
        },
        cards: {
          totalUsers,
          totalActiveUsers,
          activeToday,
          exercisesToday,
          nutritionLogsToday,
          totalNutritionItems,
          nutritionItemsAddedInRange,
          usersDelta,
          usersDeltaPercent,
        },
        charts: {
          usersCreatedByMonth,
          monthlyActiveUsers,
          nutritionLogsByDay,
        },
        donuts: {
          userStatus: userStatus.length
            ? userStatus
            : [
                { label: 'Active', value: 0 },
                { label: 'Blocked', value: 0 },
                { label: 'Deleted', value: 0 },
              ],
          exerciseTypesThisWeek: exerciseTypesThisWeek.length
            ? exerciseTypesThisWeek
            : [{ label: 'Other', value: 0 }],
          nutritionLogsThisWeek: nutritionLogsThisWeek.length
            ? nutritionLogsThisWeek
            : [{ label: 'Other', value: 0 }],
          nutritionLoggingStatus,
          exerciseLibraryCategories,
        },
        tables: {
          topFoodsThisWeek,
          topExercisesThisWeek,
        },
        recentActivity: {
          users: recentUsers,
          workouts: recentWorkouts,
          meals: recentMeals,
        },
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

module.exports = { getAdminDashboard };

