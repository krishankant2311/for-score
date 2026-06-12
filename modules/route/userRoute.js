const express = require('express');
const router = express.Router();
const upload = require('../../middleware/multer');
const { verifyAccessToken } = require('../../middleware/jwt');
const {
  signup,
  verifySignupOtp,
  resendSignupOtp,
  login,
  googleAuth,
  googleSignup,
  forgotPassword,
  resetPassword,
  getUserProfile,
  getCalorieCalculations,
  updateUserProfile,
  updateProfilePhoto,
  changeUserPassword,
  addGender,
  addHeight,
  addWeight,
  addAge,
  addWorkoutSkillLevel,
  addWorkoutPreferences,
  addFitnessTarget,
  addActivityFactor,
  addFitnessGoal,
  addTargetWeight,
  addGoalDuration,
  addWorkoutFrequency,
  addLastWorkout,
  addTrainingLocation,
  saveOneSignalPlayerId,
} = require('../controller/userController');
const {
  getAllProgramsByUser,
  getProgramByUserAndId,
  getRecommendedProgramByUserProfile,
} = require('../controller/programController');
const {
  selectActiveProgram,
  getSelectedProgramForUser,
  getWeeklyScheduleForActiveProgram,
  getProgramWorkoutsById,
  getTodayWorkout,
  getTodayExerciseDetailFromProgram,
  saveTodayExercisePerformance,
} = require('../controller/todayWorkoutController');
const {
  getDailyExerciseCompletions,
  putDailyExerciseCompletions,
  postTodayExerciseSlotCompletion,
  markAllWorkoutSlotsCompleteForDay,
  getCompletedExercisesByDateOrRange,
} = require('../controller/dailyExerciseCompletionController');
const {
  addMeasurement,
  getAllMeasurements,
  getMeasurementById,
  updateMeasurement,
  deleteMeasurement,
} = require('../controller/measurementController');
const {
  getAllPrivacyPoliciesUser,
  getPrivacyPolicyByIdUser,
} = require('../controller/privacyPolicyController');
const {
  getAllTermsConditionUser,
  getTermsConditionByIdUser,
} = require('../controller/termsConditionController');
const {
  getAboutAppForUser,
} = require('../controller/aboutAppController');
const {
  getSocialMediaForUser,
} = require('../controller/socialMediaController');
const {
  getQuotesForUser,
} = require('../controller/quoteController');
const {
  addOrUpdateWorkoutLog,
  getWorkoutLogsByDate,
  getWorkoutSummaryByDate,
  getWorkoutHistoryByExercise,
  getWorkoutLogById,
  deleteWorkoutLog,
} = require('../controller/workoutLogController');
const {
  addProgressPhoto,
  getLatestProgressPhotos,
  getProgressPhotoTimeline,
  getProgressPhotoById,
  deleteProgressPhoto,
} = require('../controller/progressPhotoController');
const {
  addOrUpdateMealLog,
  scheduleMealByFoodId,
  getDailyNutritionSummary,
  getDailyMeals,
  getSuggestedMenu,
  deleteMealLog,
  markMealLogComplete,
  markAllMealsCompleteForDay,
} = require('../controller/nutritionDashboardController');
const {
  getAllFoods,
  getAllFoodCategories,
  getFoodById,
} = require('../controller/foodController');
const {
  addFeedback,
  getMyFeedbacks,
  getMyFeedbackById,
  updateMyFeedback,
  deleteMyFeedback,
} = require('../controller/feedbackController');
const {
  getAllRecoveryContentForUser,
  getRecoveryContentByIdForUser,
} = require('../controller/recoveryContentController');
const {
  addOrUpdateSleepLog,
  getSleepLogByDate,
  getWeeklySleepLogs,
  getSleepSummary,
  deleteSleepLog,
} = require('../controller/sleepLogController');
const {
  getAllNutritionItemsForUser,
  getNutritionItemByIdForUser,
} = require('../controller/nutritionItemController');
const {
  getFaqsForUser,
  getFaqByIdForUser,
} = require('../controller/faqController');
const {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} = require('../controller/notificationController');
const {
  getAllPlansForUser,
  getSelectedPlanForUser,
  getPlanByIdForUser,
  selectPlanForUser,
} = require('../controller/planController');
const {
  getUserDashboard,
} = require('../controller/userDashboardController');
const {
  addGoal,
  getAllGoals,
  getGoalById,
  updateGoal,
  logGoalProgress,
  setPrimaryGoal,
  deleteGoal,
} = require('../controller/userGoalController');
const {
  getWaterForDate,
  upsertWaterLog,
} = require('../controller/waterLogController');
const {
  getRecoverPageData,
  getSleepTrackingPageData,
} = require('../controller/recoveryDashboardController');
const {
  getStretchProgramsPage,
  getStretchProgramByIdForUser,
  logStretchSession,
} = require('../controller/stretchProgramsController');
const { getOvalOfficePage } = require('../controller/ovalOfficeController');
const {
  upsertBodyWeightLog,
  getBodyWeightForDate,
  getLatestBodyWeight,
  getBodyWeightHistory,
  deleteBodyWeightLog,
} = require('../controller/bodyWeightLogController');
const {
  getNutritionCheatSheetForUser,
  getNutritionCheatSheetByIdForUser,
} = require('../controller/nutritionCheatSheetController');

router.post('/signup', upload.none(), signup);
router.post('/verify-signup-otp', upload.none(), verifySignupOtp);
router.post('/resend-signup-otp', upload.none(), resendSignupOtp);
router.post('/login', upload.none(), login);
router.post('/auth/google/signup', upload.none(), googleSignup);
router.post('/auth/google', upload.none(), googleAuth);
router.post('/forgot-password', upload.none(), forgotPassword);
router.post('/reset-password', upload.none(), resetPassword);
router.get('/profile', upload.none(), verifyAccessToken, getUserProfile);
router.get('/profile/calculations', upload.none(), verifyAccessToken, getCalorieCalculations);
router.post('/profile/edit', upload.none(), verifyAccessToken, updateUserProfile);
router.post('/profile/photo', upload.single('photo'), verifyAccessToken, updateProfilePhoto);
router.post('/change-password', upload.none(), verifyAccessToken, changeUserPassword);

router.post('/profile/gender', upload.none(), verifyAccessToken, addGender);
router.post('/profile/height', upload.none(), verifyAccessToken, addHeight);
router.post('/profile/weight', upload.none(), verifyAccessToken, addWeight);
router.post('/profile/age', upload.none(), verifyAccessToken, addAge);

router.post('/profile/workout-skill-level', upload.none(), verifyAccessToken, addWorkoutSkillLevel);
router.post('/profile/workout-preferences', upload.none(), verifyAccessToken, addWorkoutPreferences);
router.post('/profile/fitness-target', upload.none(), verifyAccessToken, addFitnessTarget);
router.post('/profile/activity-factor', upload.none(), verifyAccessToken, addActivityFactor);
router.post('/profile/fitness-goal', upload.none(), verifyAccessToken, addFitnessGoal);

router.post('/profile/target-weight', upload.none(), verifyAccessToken, addTargetWeight);
router.post('/profile/goal-duration', upload.none(), verifyAccessToken, addGoalDuration);
router.post('/profile/workout-frequency', upload.none(), verifyAccessToken, addWorkoutFrequency);
router.post('/profile/last-workout', upload.none(), verifyAccessToken, addLastWorkout);
router.post('/profile/training-location', upload.none(), verifyAccessToken, addTrainingLocation);
router.post('/profile/player-id', upload.none(), verifyAccessToken, saveOneSignalPlayerId);

// Programs for user — static paths before /programs/:id
router.get('/programs', upload.none(), verifyAccessToken, getAllProgramsByUser);
router.get('/programs/recommended/me', upload.none(), verifyAccessToken, getRecommendedProgramByUserProfile);
router.post('/programs/active', upload.none(), verifyAccessToken, selectActiveProgram);
router.get('/programs/active/weekly-schedule', upload.none(), verifyAccessToken, getWeeklyScheduleForActiveProgram);
router.get('/programs/selected', upload.none(), verifyAccessToken, getSelectedProgramForUser);
router.get('/programs/active', upload.none(), verifyAccessToken, getSelectedProgramForUser);
router.get('/programs/:id/workouts', upload.none(), verifyAccessToken, getProgramWorkoutsById);
router.get('/programs/:id', upload.none(), verifyAccessToken, getProgramByUserAndId);

// Measurements (user-scoped: add, get all, get by id, update, soft delete)
router.post('/add-measurements', upload.none(), verifyAccessToken, addMeasurement);
router.get('/get-all-measurements', upload.none(), verifyAccessToken, getAllMeasurements);
router.get('/get-measurements/:id', upload.none(), verifyAccessToken, getMeasurementById);
router.post('/update-measurements/:id', upload.none(), verifyAccessToken, updateMeasurement);
router.post('/delete-measurements/:id', upload.none(), verifyAccessToken, deleteMeasurement);

// Body weight log (workout modal — one entry per day, history list)
router.get('/body-weight/history', upload.none(), verifyAccessToken, getBodyWeightHistory);
router.get('/body-weight/latest', upload.none(), verifyAccessToken, getLatestBodyWeight);
router.get('/body-weight/today', upload.none(), verifyAccessToken, getBodyWeightForDate);
router.get('/body-weight', upload.none(), verifyAccessToken, getBodyWeightForDate);
router.post('/body-weight', upload.none(), verifyAccessToken, upsertBodyWeightLog);
router.post('/body-weight/:id/delete', upload.none(), verifyAccessToken, deleteBodyWeightLog);

// Privacy Policy (User read-only)
router.get('/get-all-privacy-policy-byuser', upload.none(), verifyAccessToken, getAllPrivacyPoliciesUser);
router.get('/privacy-policy-by-user/:id', upload.none(), verifyAccessToken, getPrivacyPolicyByIdUser);

// Terms & Conditions (User read-only)
router.get('/terms-condition', upload.none(), verifyAccessToken, getAllTermsConditionUser);
router.get('/terms-condition/:id', upload.none(), verifyAccessToken, getTermsConditionByIdUser);

// About App / Social / Quotes (User read-only)
router.get('/about-app', upload.none(), verifyAccessToken, getAboutAppForUser);
router.get('/social-media', upload.none(), verifyAccessToken, getSocialMediaForUser);
router.get('/quotes', upload.none(), verifyAccessToken, getQuotesForUser);

// FAQ (User read-only — Active only)
router.get('/faq', upload.none(), verifyAccessToken, getFaqsForUser);
router.get('/faq/:id', upload.none(), verifyAccessToken, getFaqByIdForUser);

// Notifications (User)
router.get('/notifications', upload.none(), verifyAccessToken, getNotificationsForUser);
router.post('/notifications/read-all', upload.none(), verifyAccessToken, markAllNotificationsRead);
router.post('/notifications/:id/read', upload.none(), verifyAccessToken, markNotificationRead);

// Recovery Content (User read-only)
router.get('/recovery-content', upload.none(), verifyAccessToken, getAllRecoveryContentForUser);
router.get('/recovery-content/:id', upload.none(), verifyAccessToken, getRecoveryContentByIdForUser);

// Foods (admin catalog for users)
router.get('/getall-foods', upload.none(), verifyAccessToken, getAllFoods);
router.get('/get-all-food-categories', upload.none(), verifyAccessToken, getAllFoodCategories);
router.get('/get-foods/:id', upload.none(), verifyAccessToken, getFoodById);

// Feedback (user → send feedback)
router.post('/add-feedback', upload.none(), verifyAccessToken, addFeedback);
router.get('/get-all-my-feedbacks', upload.none(), verifyAccessToken, getMyFeedbacks);
router.get('/get-my-feedbacks/:id', upload.none(), verifyAccessToken, getMyFeedbackById);
router.post('/update-my-feedbacks/:id', upload.none(), verifyAccessToken, updateMyFeedback);
router.post('/delete-my-feedbacks/:id', upload.none(), verifyAccessToken, deleteMyFeedback);

// Sleep Tracking (logs + summary)
router.post('/sleep-log', upload.none(), verifyAccessToken, addOrUpdateSleepLog);
router.get('/sleep-log/by-date', upload.none(), verifyAccessToken, getSleepLogByDate);
router.get('/sleep-log/week', upload.none(), verifyAccessToken, getWeeklySleepLogs);
router.get('/sleep-log/summary', upload.none(), verifyAccessToken, getSleepSummary);
router.post('/sleep-log/:id/delete', upload.none(), verifyAccessToken, deleteSleepLog);

// Nutrition catalog (read-only for user)
router.get('/get-all-nutrition-items', upload.none(), verifyAccessToken, getAllNutritionItemsForUser);
router.get('/get-nutrition-items/:id', upload.none(), verifyAccessToken, getNutritionItemByIdForUser);

// Nutrition Cheat Sheet (macro quick reference — grouped by protein / carb / fat)
router.get('/nutrition-cheat-sheet', upload.none(), verifyAccessToken, getNutritionCheatSheetForUser);
router.get('/nutrition-cheat-sheet/:id', upload.none(), verifyAccessToken, getNutritionCheatSheetByIdForUser);

// Workout Logging (user workouts)
router.post('/workouts', upload.none(), verifyAccessToken, addOrUpdateWorkoutLog);
router.get('/workouts/by-date', upload.none(), verifyAccessToken, getWorkoutLogsByDate);
router.get('/workouts/summary', upload.none(), verifyAccessToken, getWorkoutSummaryByDate);
router.get('/workouts/history', upload.none(), verifyAccessToken, getWorkoutHistoryByExercise);
router.get('/workouts/today/completions', upload.none(), verifyAccessToken, getDailyExerciseCompletions);
router.get(
  '/workouts/completed-exercises',
  upload.none(),
  verifyAccessToken,
  getCompletedExercisesByDateOrRange
);
router.post('/workouts/today/completions', upload.none(), verifyAccessToken, putDailyExerciseCompletions);
router.post(
  '/workouts/today/completions/mark-all-complete',
  upload.none(),
  verifyAccessToken,
  markAllWorkoutSlotsCompleteForDay
);
router.post(
  '/workouts/today/exercise/performance',
  upload.none(),
  verifyAccessToken,
  saveTodayExercisePerformance
);
router.post(
  '/workouts/today/exercise/completion',
  upload.none(),
  verifyAccessToken,
  postTodayExerciseSlotCompletion
);
router.get('/workouts/today/exercise', upload.none(), verifyAccessToken, getTodayExerciseDetailFromProgram);
router.get('/workouts/today', upload.none(), verifyAccessToken, getTodayWorkout);
router.get('/workouts/:id', upload.none(), verifyAccessToken, getWorkoutLogById);
router.post('/workouts/:id/delete', upload.none(), verifyAccessToken, deleteWorkoutLog);

// Progress Photos (Mission Log)
router.post('/progress-photos', upload.single('photo'), verifyAccessToken, addProgressPhoto);
router.get('/progress-photos/latest', upload.none(), verifyAccessToken, getLatestProgressPhotos);
router.get('/progress-photos/timeline', upload.none(), verifyAccessToken, getProgressPhotoTimeline);
router.get('/progress-photos/:id', upload.none(), verifyAccessToken, getProgressPhotoById);
router.post('/progress-photos/:id/delete', upload.none(), verifyAccessToken, deleteProgressPhoto);

// Nutrition Dashboard (Today’s Nutrition)
router.post('/meals', upload.none(), verifyAccessToken, addOrUpdateMealLog);
router.post('/meals/schedule', upload.none(), verifyAccessToken, scheduleMealByFoodId);
router.post('/meals/:id/complete', upload.none(), verifyAccessToken, markMealLogComplete);
router.post(
  '/nutrition/meals/mark-all-complete',
  upload.none(),
  verifyAccessToken,
  markAllMealsCompleteForDay
);
router.get('/nutrition/summary', upload.none(), verifyAccessToken, getDailyNutritionSummary);
router.get('/nutrition/meals', upload.none(), verifyAccessToken, getDailyMeals);
router.get('/nutrition/suggested-menu', upload.none(), verifyAccessToken, getSuggestedMenu);
router.post('/meals/:id/delete', upload.none(), verifyAccessToken, deleteMealLog);

// Plans (User read-only)
router.get('/plans', upload.none(), verifyAccessToken, getAllPlansForUser);
router.get('/plans/selected', upload.none(), verifyAccessToken, getSelectedPlanForUser);
router.get('/plans/:id', upload.none(), verifyAccessToken, getPlanByIdForUser);
router.post('/plans/select', upload.none(), verifyAccessToken, selectPlanForUser);

// User Dashboard (home screen) — one call returns everything the mobile
// dashboard needs: greeting, current program, today's workout, today's diet,
// and the "Your Goals" card.
router.get('/dashboard', upload.none(), verifyAccessToken, getUserDashboard);
router.get('/home', upload.none(), verifyAccessToken, getUserDashboard); // alias

// Goals (Your Goals card on dashboard)
router.post('/goals', upload.none(), verifyAccessToken, addGoal);
router.get('/goals', upload.none(), verifyAccessToken, getAllGoals);
router.get('/goals/:id', upload.none(), verifyAccessToken, getGoalById);
router.post('/goals/:id', upload.none(), verifyAccessToken, updateGoal);
router.post('/goals/:id/progress', upload.none(), verifyAccessToken, logGoalProgress);
router.post('/goals/:id/primary', upload.none(), verifyAccessToken, setPrimaryGoal);
router.post('/goals/:id/delete', upload.none(), verifyAccessToken, deleteGoal);

// Water log (Water tile on Today's Diet card)
router.get('/water', upload.none(), verifyAccessToken, getWaterForDate);
router.get('/water/today', upload.none(), verifyAccessToken, getWaterForDate);
router.post('/water', upload.none(), verifyAccessToken, upsertWaterLog);

// Recovery / Sleep page-ready APIs (mobile)
router.get('/recovery/page', upload.none(), verifyAccessToken, getRecoverPageData);
router.get('/sleep-tracking/page', upload.none(), verifyAccessToken, getSleepTrackingPageData);

// The Oval Office — account stats (workouts, streak, FOUR score)
router.get('/oval-office/page', upload.none(), verifyAccessToken, getOvalOfficePage);
router.get('/account/page', upload.none(), verifyAccessToken, getOvalOfficePage);

// Stretch Programs page (mobile)
router.get('/stretch-programs/page', upload.none(), verifyAccessToken, getStretchProgramsPage);
router.get('/stretch-programs/:id', upload.none(), verifyAccessToken, getStretchProgramByIdForUser);
router.post('/stretch-sessions', upload.none(), verifyAccessToken, logStretchSession);

module.exports = router;
