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

    const { from, to, key } = getTimeframeRange(req.query.timeframe || 'today');
    const week = getThisWeekRange();

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
      topFoodsThisWeek,
      recentUsers,
      recentWorkouts,
      recentMeals,
    ] = await Promise.all([
      // Cards
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: addDays(from, -(to - from) / (24 * 3600 * 1000)), $lt: from } }).catch(() => 0),
      // Charts - users per month (within timeframe)
      User.aggregate([
        { $match: { createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      WorkoutLog.find({ status: 'Active', date: { $gte: from, $lt: to } })
        .select('userId date')
        .lean(),
      MealLog.find({ status: 'Active', date: { $gte: from, $lt: to } })
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
        { $match: { status: 'Active', date: { $gte: week.from, $lt: week.to } } },
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
        { $match: { status: 'Active', date: { $gte: week.from, $lt: week.to } } },
        { $group: { _id: '$mealType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Top foods (this week): unwind items
      MealLog.aggregate([
        { $match: { status: 'Active', date: { $gte: week.from, $lt: week.to } } },
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
    ]);

    // Active users in timeframe = distinct users with any workout or meal log
    const activeUserSet = new Set();
    for (const w of workoutLogs) activeUserSet.add(String(w.userId));
    for (const m of mealLogs) activeUserSet.add(String(m.userId));
    const activeToday = activeUserSet.size;

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

    // Nutrition logs per day (bar chart)
    const dayBuckets = new Map(); // YYYY-MM-DD -> count
    for (const ml of mealLogs) {
      const dk = dayKey(ml.date);
      dayBuckets.set(dk, (dayBuckets.get(dk) || 0) + 1);
    }
    const nutritionByDay = Array.from(dayBuckets.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([day, count]) => ({ day, count }));

    const statusMap = { Active: 0, Blocked: 0, Deleted: 0 };
    for (const r of userStatusCounts || []) {
      const k = String(r._id || '');
      if (k in statusMap) statusMap[k] = r.count;
    }

    const usersDelta = totalUsersPrevRange ? totalUsers - totalUsersPrevRange : null;
    const usersDeltaPercent =
      totalUsersPrevRange && totalUsersPrevRange > 0
        ? safePercent(usersDelta, totalUsersPrevRange)
        : null;

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
          exerciseTypesThisWeek: (exerciseTypesThisWeek || []).map((r) => ({
            label: r._id || 'Other',
            value: r.count,
          })),
          nutritionLogsThisWeek: (nutritionLogsByTypeThisWeek || []).map((r) => ({
            label: r._id || 'Other',
            value: r.count,
          })),
        },
        tables: {
          topFoodsThisWeek: topFoodsThisWeek || [],
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

