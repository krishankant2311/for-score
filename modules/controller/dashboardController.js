const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const WorkoutLog = require('../model/workoutLogModel');
const MealLog = require('../model/mealLogModel');
const Exercise = require('../model/exerciseModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const dayKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const monthKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const getTimeframeRange = (timeframe) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  if (String(timeframe).toLowerCase() === '7d') {
    const from = addDays(todayStart, -6);
    return { from, to: tomorrowStart, key: '7d' };
  }
  if (String(timeframe).toLowerCase() === '30d') {
    const from = addDays(todayStart, -29);
    return { from, to: tomorrowStart, key: '30d' };
  }
  // default: today
  return { from: todayStart, to: tomorrowStart, key: 'today' };
};

const getThisWeekRange = () => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const from = addDays(todayStart, -6);
  const to = addDays(todayStart, 1);
  return { from, to };
};

const safePercent = (num, den) => {
  if (!den) return 0;
  return Math.round((num / den) * 100);
};

const startOfMonth = (d) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addMonths = (d, months) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
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

    const { from, to, key } = getTimeframeRange(req.query.timeframe || 'today'); // cards timeframe
    const week = getThisWeekRange();
    // Widgets (donuts/tables) should show data for selected timeframe.
    // If timeframe=today, fallback to "this week" so charts don't look empty.
    const widgetsFrom = key === 'today' ? week.from : from;
    const widgetsTo = key === 'today' ? week.to : to;
    const now = new Date();
    const chartsFrom = startOfMonth(addMonths(now, -5)); // last 6 months window
    const chartsTo = addDays(startOfDay(now), 1);
    const last7From = addDays(startOfDay(now), -6);

    const [
      totalUsers,
      totalUsersPrevRange,
      usersCreatedSeriesRaw,
      workoutLogs,
      mealLogs,
      userStatusCounts,
      exercisesToday,
      nutritionLogsToday,
      exerciseTypesThisWeek,
      nutritionLogsByTypeThisWeek,
      nutritionLoggingSummary,
      topExercisesThisWeek,
      exerciseLibraryByCategory,
      topFoodsThisWeek,
      recentUsers,
      recentWorkouts,
      recentMeals,
      activeUsers,
    ] = await Promise.all([
      // Cards
      User.countDocuments({}),
      // keep old delta calculation placeholder; will refine below
      User.countDocuments({ createdAt: { $gte: addDays(from, -(to - from) / (24 * 3600 * 1000)), $lt: from } }).catch(() => 0),
      // Charts - users created per month (last 6 months)
      User.aggregate([
        { $match: { createdAt: { $gte: chartsFrom, $lt: chartsTo } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      // For charts we want broader window, not only cards timeframe
      WorkoutLog.find({ status: 'Active', date: { $gte: chartsFrom, $lt: chartsTo } })
        .select('userId date')
        .lean(),
      MealLog.find({ status: 'Active', date: { $gte: chartsFrom, $lt: chartsTo } })
        .select('userId date')
        .lean(),
      // Donut - user status
      User.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Cards
      WorkoutLog.countDocuments({ status: 'Active', date: { $gte: from, $lt: to } }),
      MealLog.countDocuments({ status: 'Active', date: { $gte: from, $lt: to } }),
      // Donut - exercise types (this week) via lookup to Exercise by title==exerciseName then group by category
      WorkoutLog.aggregate([
        { $match: { status: 'Active', date: { $gte: widgetsFrom, $lt: widgetsTo } } },
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
            category: {
              $ifNull: [{ $arrayElemAt: ['$exerciseDoc.category', 0] }, 'Other'],
            },
          },
        },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Donut - nutrition logs by mealType (this week)
      MealLog.aggregate([
        { $match: { status: 'Active', date: { $gte: widgetsFrom, $lt: widgetsTo } } },
        { $group: { _id: '$mealType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Nutrition logging (On track / Partial / Missed) across Active users for the widget range
      (async () => {
        const totalActiveUsers = await User.countDocuments({ status: 'Active' });
        const totalDays = Math.max(
          1,
          Math.round((widgetsTo.getTime() - widgetsFrom.getTime()) / (24 * 60 * 60 * 1000))
        );

        const perUserDay = await MealLog.aggregate([
          { $match: { status: 'Active', date: { $gte: widgetsFrom, $lt: widgetsTo } } },
          {
            $group: {
              _id: { userId: '$userId', day: '$date' },
              mealTypes: { $addToSet: '$mealType' },
            },
          },
          {
            $project: {
              mealCount: { $size: '$mealTypes' },
            },
          },
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

        return {
          totalActiveUsers,
          totalDays,
          onTrack,
          partial,
          missed,
        };
      })(),
      // Top exercises (by workout logs) for widget range
      WorkoutLog.aggregate([
        { $match: { status: 'Active', date: { $gte: widgetsFrom, $lt: widgetsTo } } },
        { $group: { _id: '$exerciseName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: '$_id', count: 1 } },
      ]),
      // Exercise library breakdown (admin uploaded exercises) by category
      Exercise.aggregate([
        { $match: { status: 'Active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Top foods (this week): unwind items
      MealLog.aggregate([
        { $match: { status: 'Active', date: { $gte: widgetsFrom, $lt: widgetsTo } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            count: { $sum: 1 },
            calories: { $sum: '$items.calories' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            name: '$_id',
            count: 1,
            calories: 1,
          },
        },
      ]),
      // Recent activity
      User.find({})
        .select('name email createdAt status')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      WorkoutLog.find({ status: 'Active' })
        .select('userId exerciseName date createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      MealLog.find({ status: 'Active' })
        .select('userId mealType date createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Cards
      User.countDocuments({ status: 'Active' }),
    ]);

    // UI "Active Today" should reflect active accounts (not log activity)
    const activeToday = activeUsers;

    // Users per month series (within timeframe)
    const usersCreatedSeries = usersCreatedSeriesRaw.map((r) => {
      const y = r._id.y;
      const m = String(r._id.m).padStart(2, '0');
      return { month: `${y}-${m}`, count: r.count };
    });

    // Monthly active users (distinct per month) - derived from logs within timeframe
    const monthlyActiveMap = new Map(); // month -> Set(userId)
    const addToMonthlyActive = (userId, date) => {
      const mk = monthKey(new Date(date));
      if (!monthlyActiveMap.has(mk)) monthlyActiveMap.set(mk, new Set());
      monthlyActiveMap.get(mk).add(String(userId));
    };
    for (const w of workoutLogs) addToMonthlyActive(w.userId, w.date);
    for (const m of mealLogs) addToMonthlyActive(m.userId, m.date);
    const monthlyActiveSeries = Array.from(monthlyActiveMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([month, set]) => ({ month, count: set.size }));

    // Nutrition logs per day (bar chart, always last 7 days incl 0)
    const dayBuckets = new Map(); // YYYY-MM-DD -> count
    for (const ml of mealLogs) {
      const dk = dayKey(ml.date);
      dayBuckets.set(dk, (dayBuckets.get(dk) || 0) + 1);
    }
    const nutritionByDay = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(last7From, i);
      const kDay = dayKey(d);
      nutritionByDay.push({ day: kDay, count: dayBuckets.get(kDay) || 0 });
    }

    const statusMap = { Active: 0, Blocked: 0, Deleted: 0 };
    for (const r of userStatusCounts || []) {
      const k = String(r._id || '');
      if (k in statusMap) statusMap[k] = r.count;
    }

    // Users delta: last 30 days signups vs previous 30 days
    const prev30From = addDays(startOfDay(now), -59);
    const prev30To = addDays(startOfDay(now), -29);
    const this30From = addDays(startOfDay(now), -29);
    const [this30, prev30] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: this30From, $lt: chartsTo } }),
      User.countDocuments({ createdAt: { $gte: prev30From, $lt: prev30To } }),
    ]);
    const usersDelta = prev30 ? this30 - prev30 : null;
    const usersDeltaPercent = prev30 ? safePercent(usersDelta, prev30) : null;

    return res.json({
      success: true,
      message: 'Dashboard data fetched successfully',
      result: {
        timeframe: key,
        range: { from, to },
        cards: {
          totalUsers,
          activeToday,
          exercisesToday,
          nutritionLogsToday,
          usersDelta,
          usersDeltaPercent,
        },
        charts: {
          usersCreatedByMonth: usersCreatedSeries,
          monthlyActiveUsers: monthlyActiveSeries,
          nutritionLogsByDay: nutritionByDay,
        },
        donuts: {
          userStatus: [
            { label: 'Active', value: statusMap.Active },
            { label: 'Blocked', value: statusMap.Blocked },
            { label: 'Deleted', value: statusMap.Deleted },
          ],
          exerciseTypesThisWeek: (exerciseTypesThisWeek && exerciseTypesThisWeek.length
            ? exerciseTypesThisWeek
            : [{ _id: 'Other', count: 0 }]
          ).map((r) => ({
            label: r._id || 'Other',
            value: r.count,
          })),
          nutritionLogsThisWeek: (nutritionLogsByTypeThisWeek && nutritionLogsByTypeThisWeek.length
            ? nutritionLogsByTypeThisWeek
            : [{ _id: 'Other', count: 0 }]
          ).map((r) => ({
            label: r._id || 'Other',
            value: r.count,
          })),
          nutritionLoggingStatus: [
            { label: 'On track', value: nutritionLoggingSummary?.onTrack || 0 },
            { label: 'Partial', value: nutritionLoggingSummary?.partial || 0 },
            { label: 'Missed', value: nutritionLoggingSummary?.missed || 0 },
          ],
          exerciseLibraryCategories: (exerciseLibraryByCategory && exerciseLibraryByCategory.length
            ? exerciseLibraryByCategory
            : [{ _id: 'Other', count: 0 }]
          ).map((r) => ({ label: r._id || 'Other', value: r.count })),
        },
        tables: {
          topFoodsThisWeek: topFoodsThisWeek || [],
          topExercisesThisWeek: topExercisesThisWeek || [],
        },
        recentActivity: {
          users: recentUsers || [],
          workouts: recentWorkouts || [],
          meals: recentMeals || [],
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

