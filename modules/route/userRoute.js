const express = require('express');
const router = express.Router();
const upload = require('../../middleware/multer');
const { verifyAccessToken } = require('../../middleware/jwt');
const {
  signup,
  login,
  changeUserPassword,
  addGender,
  addHeight,
  addWeight,
  addAge,
  addWorkoutSkillLevel,
  addWorkoutPreferences,
  addFitnessTarget,
  addFitnessGoal,
  addTargetWeight,
  addGoalDuration,
  addWorkoutFrequency,
  addLastWorkout,
  addTrainingLocation,
} = require('../controller/userController');
const {
  getAllProgramsByUser,
  getProgramByUserAndId,
  getRecommendedProgramByUserProfile,
} = require('../controller/programController');
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
  getDailyNutritionSummary,
  getDailyMeals,
  getSuggestedMenu,
  deleteMealLog,
} = require('../controller/nutritionDashboardController');
const {
  addFood,
  getAllFoods,
  getFoodById,
  updateFood,
  deleteFood,
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
  markNotificationRead,
} = require('../controller/notificationController');

router.post('/signup', upload.none(), signup);
router.post('/login', upload.none(), login);
router.post('/change-password', upload.none(), verifyAccessToken, changeUserPassword);

router.post('/profile/gender', upload.none(), verifyAccessToken, addGender);
router.post('/profile/height', upload.none(), verifyAccessToken, addHeight);
router.post('/profile/weight', upload.none(), verifyAccessToken, addWeight);
router.post('/profile/age', upload.none(), verifyAccessToken, addAge);

router.post('/profile/workout-skill-level', upload.none(), verifyAccessToken, addWorkoutSkillLevel);
router.post('/profile/workout-preferences', upload.none(), verifyAccessToken, addWorkoutPreferences);
router.post('/profile/fitness-target', upload.none(), verifyAccessToken, addFitnessTarget);
router.post('/profile/fitness-goal', upload.none(), verifyAccessToken, addFitnessGoal);

router.post('/profile/target-weight', upload.none(), verifyAccessToken, addTargetWeight);
router.post('/profile/goal-duration', upload.none(), verifyAccessToken, addGoalDuration);
router.post('/profile/workout-frequency', upload.none(), verifyAccessToken, addWorkoutFrequency);
router.post('/profile/last-workout', upload.none(), verifyAccessToken, addLastWorkout);
router.post('/profile/training-location', upload.none(), verifyAccessToken, addTrainingLocation);

// Programs for user (only Active/Draft, not Deleted)
router.get('/programs', upload.none(), verifyAccessToken, getAllProgramsByUser);
router.get('/programs/:id', upload.none(), verifyAccessToken, getProgramByUserAndId);
router.get('/programs/recommended/me', upload.none(), verifyAccessToken, getRecommendedProgramByUserProfile);

// Measurements (user-scoped: add, get all, get by id, update, soft delete)
router.post('/add-measurements', upload.none(), verifyAccessToken, addMeasurement);
router.get('/get-all-measurements', upload.none(), verifyAccessToken, getAllMeasurements);
router.get('/get-measurements/:id', upload.none(), verifyAccessToken, getMeasurementById);
router.post('/update-measurements/:id', upload.none(), verifyAccessToken, updateMeasurement);
router.post('/delete-measurements/:id', upload.none(), verifyAccessToken, deleteMeasurement);

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
router.post('/notifications/:id/read', upload.none(), verifyAccessToken, markNotificationRead);

// Recovery Content (User read-only)
router.get('/recovery-content', upload.none(), verifyAccessToken, getAllRecoveryContentForUser);
router.get('/recovery-content/:id', upload.none(), verifyAccessToken, getRecoveryContentByIdForUser);

// Foods (user-scoped CRUD)
router.post('/add-foods', upload.none(), verifyAccessToken, addFood);
router.get('/getall-foods', upload.none(), verifyAccessToken, getAllFoods);
router.get('/get-foods/:id', upload.none(), verifyAccessToken, getFoodById);
router.post('/update-foods/:id', upload.none(), verifyAccessToken, updateFood);
router.post('/delete-foods/:id', upload.none(), verifyAccessToken, deleteFood);

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

// Workout Logging (user workouts)
router.post('/workouts', upload.none(), verifyAccessToken, addOrUpdateWorkoutLog);
router.get('/workouts/by-date', upload.none(), verifyAccessToken, getWorkoutLogsByDate);
router.get('/workouts/summary', upload.none(), verifyAccessToken, getWorkoutSummaryByDate);
router.get('/workouts/history', upload.none(), verifyAccessToken, getWorkoutHistoryByExercise);
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
router.get('/nutrition/summary', upload.none(), verifyAccessToken, getDailyNutritionSummary);
router.get('/nutrition/meals', upload.none(), verifyAccessToken, getDailyMeals);
router.get('/nutrition/suggested-menu', upload.none(), verifyAccessToken, getSuggestedMenu);
router.post('/meals/:id/delete', upload.none(), verifyAccessToken, deleteMealLog);

module.exports = router;
