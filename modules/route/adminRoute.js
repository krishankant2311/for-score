const express = require('express');
const router = express.Router();
const multerMiddleware = require('../../middleware/multer');
const upload = multerMiddleware;
const uploadExerciseMedia = multerMiddleware.uploadExerciseMedia;
const { verifyAccessToken } = require('../../middleware/jwt');
const {
  adminLogin,
  logoutAdmin,
  changePassword,
  forgotPassword,
  resetPassword,
  getAdminProfile,
  updateAdminProfile,
  getAllUsers,
  getUserStats,
  getUserById,
  updateUserStatus,
  deleteUser,
} = require('../controller/adminController');
const {
  addExercise,
  getAllExercises,
  getExerciseById,
  updateExercise,
  deleteExercise,
} = require('../controller/exerciseController');
const {
  addDietPlan,
  getAllDietPlans,
  getDietPlanById,
  updateDietPlan,
  deleteDietPlan,
} = require('../controller/dietPlanController');
const {
  addNutritionItem,
  getAllNutritionItems,
  getNutritionItemById,
  updateNutritionItem,
  deleteNutritionItem,
  getNutritionStats,
} = require('../controller/nutritionItemController');
const {
  addRecoveryContent,
  getAllRecoveryContent,
  getRecoveryContentStats,
  getRecoveryContentById,
  updateRecoveryContent,
  deleteRecoveryContent,
} = require('../controller/recoveryContentController');
const {
  getAllActiveUsersByAdmin,
  getAllBlockedUsersByAdmin,
  getUserByIdByAdmin,
  getActiveUserByIdByAdmin,
  getBlockedUserByIdByAdmin,
} = require('../controller/userController');
const {
  addProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
} = require('../controller/programController');
const {
  addPrivacyPolicy,
  getAllPrivacyPoliciesAdmin,
  getPrivacyPolicyByIdAdmin,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
} = require('../controller/privacyPolicyController');
const {
  addTermsCondition,
  getAllTermsConditionAdmin,
  getTermsConditionByIdAdmin,
  updateTermsCondition,
  deleteTermsCondition,
} = require('../controller/termsConditionController');
const {
  addAboutApp,
  getAllAboutAppAdmin,
  getAboutAppByIdAdmin,
  updateAboutApp,
  deleteAboutApp,
} = require('../controller/aboutAppController');
const {
  addSocialMedia,
  getAllSocialMediaAdmin,
  getSocialMediaByIdAdmin,
  updateSocialMedia,
  deleteSocialMedia,
} = require('../controller/socialMediaController');
const {
  addQuote,
  getAllQuotesAdmin,
  getQuoteByIdAdmin,
  updateQuote,
  deleteQuote,
} = require('../controller/quoteController');
const {
  getAllFeedbackAdmin,
  getFeedbackByIdAdmin,
  updateFeedbackStatus,
  deleteFeedback,
} = require('../controller/feedbackController');
const {
  addFaq,
  getAllFaqsAdmin,
  getFaqByIdAdmin,
  updateFaq,
  deleteFaq,
} = require('../controller/faqController');
const {
  sendNotificationByAdmin,
  getAllNotificationsAdmin,
} = require('../controller/notificationController');
const {
  getAppSettings,
  saveAppSettings,
} = require('../controller/appSettingsController');
const {
  addPlan,
  getAllPlansAdmin,
  getPlanByIdAdmin,
  updatePlan,
  deletePlan,
} = require('../controller/planController');
const { getAdminDashboard } = require('../controller/dashboardController');

router.post('/login', upload.none(), adminLogin);
router.post('/logout', upload.none(), verifyAccessToken, logoutAdmin);
router.post('/change-password', upload.none(), verifyAccessToken, changePassword);
router.post('/forgot-password', upload.none(), forgotPassword);
router.post('/reset-password', upload.none(), resetPassword);
router.get('/profile', upload.none(), verifyAccessToken, getAdminProfile);
router.post('/profile', upload.none(), verifyAccessToken, updateAdminProfile);
router.get('/get-app-settings', upload.none(), verifyAccessToken, getAppSettings);
router.post('/save-app-settings', upload.none(), verifyAccessToken, saveAppSettings);
router.get('/get-all-users', upload.none(), verifyAccessToken, getAllUsers);
router.get('/get-all-active-users', upload.none(), verifyAccessToken, getAllActiveUsersByAdmin);
router.get('/get-all-blocked-users', upload.none(), verifyAccessToken, getAllBlockedUsersByAdmin);
router.get('/get-user-stats', upload.none(), verifyAccessToken, getUserStats);
router.get('/dashboard', upload.none(), verifyAccessToken, getAdminDashboard);
router.get('/get-users/:id', upload.none(), verifyAccessToken, getUserByIdByAdmin);
router.get('/get-active-users/:id', upload.none(), verifyAccessToken, getActiveUserByIdByAdmin);
router.get('/users/blocked/:id', upload.none(), verifyAccessToken, getBlockedUserByIdByAdmin);
router.post('/userstatus/:id', upload.none(), verifyAccessToken, updateUserStatus);
router.post('/users/:id', upload.none(), verifyAccessToken, deleteUser);

// Exercise management (order: list/add before :id)
router.post('/exercises', verifyAccessToken, uploadExerciseMedia.single('media'), addExercise);
router.get('/get-all-exercises', upload.none(), verifyAccessToken, getAllExercises);
router.get('/get-exercises/:id', upload.none(), verifyAccessToken, getExerciseById);
router.post('/update-exercises/:id', verifyAccessToken, uploadExerciseMedia.single('media'), updateExercise);
router.post('/delete-exercises/:id', upload.none(), verifyAccessToken, deleteExercise);

// Diet plan (Nutrition & Macros)
router.post('/diet-plans', upload.none(), verifyAccessToken, addDietPlan);
router.get('/diet-plans', upload.none(), verifyAccessToken, getAllDietPlans);
router.get('/diet-plans/:id', upload.none(), verifyAccessToken, getDietPlanById);
router.put('/diet-plans/:id', upload.none(), verifyAccessToken, updateDietPlan);
router.delete('/diet-plans/:id', upload.none(), verifyAccessToken, deleteDietPlan);

// Nutrition Items (Food catalog for plans)
router.post('/add-nutrition-items', verifyAccessToken, upload.single('image'), addNutritionItem);
router.get('/get-all-nutrition-items', upload.none(), verifyAccessToken, getAllNutritionItems);
router.get('/get-nutrition-items/:id', upload.none(), verifyAccessToken, getNutritionItemById);
router.put('/update-nutrition-items/:id', verifyAccessToken, upload.single('image'), updateNutritionItem);
router.delete('/delete-nutrition-items/:id', upload.none(), verifyAccessToken, deleteNutritionItem);
router.get('/get-nutrition-items-stats', upload.none(), verifyAccessToken, getNutritionStats);

// Recovery Content (Breathing, Stretching, Sleep, etc.)
router.post('/add-recovery-content', verifyAccessToken, uploadExerciseMedia.single('media'), addRecoveryContent);
router.get('/get-all-recovery-content', upload.none(), verifyAccessToken, getAllRecoveryContent);
router.get('/get-recovery-content-stats', upload.none(), verifyAccessToken, getRecoveryContentStats);
router.get('/get-recovery-content/:id', upload.none(), verifyAccessToken, getRecoveryContentById);
router.put('/update-recovery-content/:id', verifyAccessToken, uploadExerciseMedia.single('media'), updateRecoveryContent);
router.delete('/delete-recovery-content/:id', upload.none(), verifyAccessToken, deleteRecoveryContent);

// Programs (Workout Programs)
router.post('/add-programs', upload.none(), verifyAccessToken, addProgram);
router.get('/get-all-programs', upload.none(), verifyAccessToken, getAllPrograms);
router.get('/programs/:id', upload.none(), verifyAccessToken, getProgramById);
router.post('/update-programs/:id', upload.none(), verifyAccessToken, updateProgram);
router.post('/delete-program/:id', upload.none(), verifyAccessToken, deleteProgram);

// Privacy Policy (Admin CRUD)
router.post('/privacy-policy', upload.none(), verifyAccessToken, addPrivacyPolicy);
router.get('/getAll-privacy-policy', upload.none(), verifyAccessToken, getAllPrivacyPoliciesAdmin);
router.get('/getprivacy-policy/:id', upload.none(), verifyAccessToken, getPrivacyPolicyByIdAdmin);
router.post('/update-privacy-policy/:id', upload.none(), verifyAccessToken, updatePrivacyPolicy);
router.post('/delete-privacy-policy/:id', upload.none(), verifyAccessToken, deletePrivacyPolicy);

// Terms & Conditions (Admin CRUD; single-doc upsert on add)
router.post('/terms-condition', upload.none(), verifyAccessToken, addTermsCondition);
router.get('/getAll-terms-condition', upload.none(), verifyAccessToken, getAllTermsConditionAdmin);
router.get('/getterms-condition/:id', upload.none(), verifyAccessToken, getTermsConditionByIdAdmin);
router.post('/update-terms-condition/:id', upload.none(), verifyAccessToken, updateTermsCondition);
router.post('/delete-terms-condition/:id', upload.none(), verifyAccessToken, deleteTermsCondition);

// About App (Admin CRUD)
router.post('/about-app', upload.none(), verifyAccessToken, addAboutApp);
router.get('/getAll-about-app', upload.none(), verifyAccessToken, getAllAboutAppAdmin);
router.get('/getabout-app/:id', upload.none(), verifyAccessToken, getAboutAppByIdAdmin);
router.post('/update-about-app/:id', upload.none(), verifyAccessToken, updateAboutApp);
router.post('/delete-about-app/:id', upload.none(), verifyAccessToken, deleteAboutApp);

// Social Media (Admin CRUD)
router.post('/social-media', upload.none(), verifyAccessToken, addSocialMedia);
router.get('/getAll-social-media', upload.none(), verifyAccessToken, getAllSocialMediaAdmin);
router.get('/getsocial-media/:id', upload.none(), verifyAccessToken, getSocialMediaByIdAdmin);
router.post('/update-social-media/:id', upload.none(), verifyAccessToken, updateSocialMedia);
router.post('/delete-social-media/:id', upload.none(), verifyAccessToken, deleteSocialMedia);

// Quotes (Admin CRUD)
router.post('/add-quotes', upload.none(), verifyAccessToken, addQuote);
router.get('/getAll-quotes', upload.none(), verifyAccessToken, getAllQuotesAdmin);
router.get('/getquotes/:id', upload.none(), verifyAccessToken, getQuoteByIdAdmin);
router.post('/update-quotes/:id', upload.none(), verifyAccessToken, updateQuote);
router.post('/delete-quotes/:id', upload.none(), verifyAccessToken, deleteQuote);

// Feedback (Admin view & manage)
router.get('/get-all-feedback-byadmin', upload.none(), verifyAccessToken, getAllFeedbackAdmin);
router.get('/get-feedback-byadmin/:id', upload.none(), verifyAccessToken, getFeedbackByIdAdmin);
router.post('/update-feedback-status-byadmin/:id', upload.none(), verifyAccessToken, updateFeedbackStatus);
router.post('/delete-feedback-byadmin/:id', upload.none(), verifyAccessToken, deleteFeedback);

// FAQ (Admin CRUD)
router.post('/add-faq', upload.none(), verifyAccessToken, addFaq);
router.get('/get-all-faq', upload.none(), verifyAccessToken, getAllFaqsAdmin);
router.get('/get-faq/:id', upload.none(), verifyAccessToken, getFaqByIdAdmin);
router.post('/update-faq/:id', upload.none(), verifyAccessToken, updateFaq);
router.post('/delete-faq/:id', upload.none(), verifyAccessToken, deleteFaq);

// Plans (Admin CRUD)
router.post('/add-plan', upload.none(), verifyAccessToken, addPlan);
router.get('/get-all-plans', upload.none(), verifyAccessToken, getAllPlansAdmin);
router.get('/get-plan/:id', upload.none(), verifyAccessToken, getPlanByIdAdmin);
router.post('/update-plan/:id', upload.none(), verifyAccessToken, updatePlan);
router.post('/delete-plan/:id', upload.none(), verifyAccessToken, deletePlan);

// Notifications (Admin)
router.post('/send-notification', upload.none(), verifyAccessToken, sendNotificationByAdmin);
router.get('/get-all-notifications', upload.none(), verifyAccessToken, getAllNotificationsAdmin);

module.exports = router;
