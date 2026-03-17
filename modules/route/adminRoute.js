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
  getAllFeedbackAdmin,
  getFeedbackByIdAdmin,
  updateFeedbackStatus,
  deleteFeedback,
} = require('../controller/feedbackController');

router.post('/login', upload.none(), adminLogin);
router.post('/logout', upload.none(), verifyAccessToken, logoutAdmin);
router.post('/change-password', upload.none(), verifyAccessToken, changePassword);
router.get('/profile', upload.none(), verifyAccessToken, getAdminProfile);
router.post('/profile', upload.none(), verifyAccessToken, updateAdminProfile);
router.get('/get-all-users', upload.none(), verifyAccessToken, getAllUsers);
router.get('/get-all-active-users', upload.none(), verifyAccessToken, getAllActiveUsersByAdmin);
router.get('/get-all-blocked-users', upload.none(), verifyAccessToken, getAllBlockedUsersByAdmin);
router.get('/get-user-stats', upload.none(), verifyAccessToken, getUserStats);
router.get('/get-users/:id', upload.none(), verifyAccessToken, getUserByIdByAdmin);
router.get('/get-active-users/:id', upload.none(), verifyAccessToken, getActiveUserByIdByAdmin);
router.get('/users/blocked/:id', upload.none(), verifyAccessToken, getBlockedUserByIdByAdmin);
router.post('/userstatus/:id', upload.none(), verifyAccessToken, updateUserStatus);
router.post('/users/:id', upload.none(), verifyAccessToken, deleteUser);

// Exercise management (order: list/add before :id)
router.post('/exercises', verifyAccessToken, uploadExerciseMedia.single('media'), addExercise);
router.get('/exercises', upload.none(), verifyAccessToken, getAllExercises);
router.get('/exercises/:id', upload.none(), verifyAccessToken, getExerciseById);
router.put('/exercises/:id', verifyAccessToken, uploadExerciseMedia.single('media'), updateExercise);
router.delete('/exercises/:id', upload.none(), verifyAccessToken, deleteExercise);

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
router.post('/recovery-content', verifyAccessToken, uploadExerciseMedia.single('media'), addRecoveryContent);
router.get('/recovery-content', upload.none(), verifyAccessToken, getAllRecoveryContent);
router.get('/recovery-content/stats', upload.none(), verifyAccessToken, getRecoveryContentStats);
router.get('/recovery-content/:id', upload.none(), verifyAccessToken, getRecoveryContentById);
router.put('/recovery-content/:id', verifyAccessToken, uploadExerciseMedia.single('media'), updateRecoveryContent);
router.delete('/recovery-content/:id', upload.none(), verifyAccessToken, deleteRecoveryContent);

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

// Feedback (Admin view & manage)
router.get('/feedback', upload.none(), verifyAccessToken, getAllFeedbackAdmin);
router.get('/feedback/:id', upload.none(), verifyAccessToken, getFeedbackByIdAdmin);
router.post('/feedback/:id/status', upload.none(), verifyAccessToken, updateFeedbackStatus);
router.post('/feedback/:id/delete', upload.none(), verifyAccessToken, deleteFeedback);

module.exports = router;
