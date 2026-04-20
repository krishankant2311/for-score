const User = require('../model/userModel');
const { Admin } = require('../model/adminModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateAccessToken } = require('../../middleware/jwt');

const isPasswordValid = (password) => {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
};

/** Spaces / hyphens → underscores; lowercase (for onboarding enum matching). */
const toSnakeToken = (raw) =>
  String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');

const LAST_WORKOUT_ALIASES = {
  last6months: 'last_6_months',
  last_6month: 'last_6_months',
  six_months: 'last_6_months',
  '6_months': 'last_6_months',
  never: 'never_or_over_a_year',
  never_worked_out: 'never_or_over_a_year',
  over_a_year: 'never_or_over_a_year',
};

const TRAINING_LOCATION_ALIASES = {
  home: 'home_workouts',
  home_workout: 'home_workouts',
  at_home: 'home_workouts',
  gym: 'gym_training',
  at_gym: 'gym_training',
  gym_workout: 'gym_training',
};

const parseLastWorkoutSignup = (raw) => {
  if (raw == null || raw === '') return null;
  let v = toSnakeToken(raw);
  if (LAST_WORKOUT_ALIASES[v]) v = LAST_WORKOUT_ALIASES[v];
  const allowed = ['last_week', 'last_month', 'last_6_months', 'never_or_over_a_year'];
  return allowed.includes(v) ? v : null;
};

const parseTrainingLocationSignup = (raw) => {
  if (raw == null || raw === '') return null;
  let v = toSnakeToken(raw);
  if (TRAINING_LOCATION_ALIASES[v]) v = TRAINING_LOCATION_ALIASES[v];
  const allowed = ['home_workouts', 'gym_training'];
  return allowed.includes(v) ? v : null;
};

const signup = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      gender,
      heightFeet,
      heightInches,
      height, // optional direct inches/cm
      weight,
      age,
      fitnessGoal, // weeklyWeightGoal
      workoutSkillLevel,
      workoutPreferences,
      fitnessTarget,
      targetweight,
      goalDuration,
      workoutFrequency,
      lastWorkout: lastWorkoutBody,
      trainingLocation: trainingLocationBody,
      last_workout: lastWorkoutSnake,
      training_location: trainingLocationSnake,
    } = req.body;

    const lastWorkout = lastWorkoutBody ?? lastWorkoutSnake;
    const trainingLocation = trainingLocationBody ?? trainingLocationSnake;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    const emailTrimmed = email.trim().toLowerCase();

    if (!isPasswordValid(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must have at least one uppercase, one lowercase, one number, and one symbol (min 8 characters)',
      });
    }

    const existingUser = await User.findOne({ email: emailTrimmed });
    if (existingUser) {
      if (existingUser.status === 'Deleted') {
        return res.status(400).json({
          success: false,
          message: 'This user is deleted. Please sign up with a new email.',
          result: {},
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Please sign in.',
        result: {},
      });
    }
    // Build initial profile fields from onboarding flow
    const profileUpdate = {};

    if (gender) {
      const g = String(gender).toLowerCase();
      if (['male', 'female', 'other'].includes(g)) {
        profileUpdate.gender = g;
      }
    }

    let heightVal = height;
    if ((heightVal == null || heightVal === '') && (heightFeet != null || heightInches != null)) {
      const ft = Number(heightFeet || 0);
      const inch = Number(heightInches || 0);
      if (!Number.isNaN(ft) && !Number.isNaN(inch)) {
        heightVal = ft * 12 + inch;
      }
    }
    if (heightVal != null && heightVal !== '' && !Number.isNaN(Number(heightVal))) {
      profileUpdate.height = Number(heightVal);
    }

    if (weight != null && weight !== '' && !Number.isNaN(Number(weight))) {
      profileUpdate.weight = Number(weight);
    }

    if (age != null && age !== '' && !Number.isNaN(Number(age))) {
      profileUpdate.age = Number(age);
    }

    if (fitnessGoal) {
      const allowedGoals = ['lose_1', 'lose_0_5', 'maintain', 'gain_0_5', 'gain_1'];
      const goalVal = String(fitnessGoal).toLowerCase();
      if (allowedGoals.includes(goalVal)) {
        profileUpdate.weeklyWeightGoal = goalVal;
      }
    }

    if (workoutSkillLevel) {
      const wl = String(workoutSkillLevel).toUpperCase();
      const allowed = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
      if (allowed.includes(wl)) {
        profileUpdate.workoutSkillLevel = wl;
      }
    }

    if (workoutPreferences) {
      // expect comma-separated string from UI
      profileUpdate.workoutPreferences = String(workoutPreferences).trim();
    }

    if (fitnessTarget) {
      const ft = String(fitnessTarget).toUpperCase();
      const allowedTargets = ['WEIGHTLOSS', 'MUSCLEGAIN', 'STRENGTH', 'GENRALFITNESS'];
      if (allowedTargets.includes(ft)) {
        profileUpdate.fitnessTarget = ft;
      }
    }

    if (targetweight != null && targetweight !== '' && !Number.isNaN(Number(targetweight))) {
      profileUpdate.targetweight = Number(targetweight);
    }

    if (goalDuration) {
      const gd = String(goalDuration).toLowerCase();
      const allowedGD = ['8w', '12w', '16w', '24w'];
      if (allowedGD.includes(gd)) {
        profileUpdate.goalDuration = gd;
      }
    }

    if (workoutFrequency != null && workoutFrequency !== '' && !Number.isNaN(Number(workoutFrequency))) {
      const wf = Number(workoutFrequency);
      if ([3, 4, 5, 6].includes(wf)) {
        profileUpdate.workoutFrequency = wf;
      }
    }

    const lwParsed = parseLastWorkoutSignup(lastWorkout);
    if (lwParsed) profileUpdate.lastWorkout = lwParsed;

    const tlParsed = parseTrainingLocationSignup(trainingLocation);
    if (tlParsed) profileUpdate.trainingLocation = tlParsed;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: emailTrimmed,
      password: hashedPassword,
      ...profileUpdate,
    });

    const payload = { _id: user._id, email: user.email };
    const token = generateAccessToken(payload);

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      data: userObj,
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const emailTrimmed = email.trim().toLowerCase();

    const user = await User.findOne({ email: emailTrimmed });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const payload = { _id: user._id, email: user.email };
    const token = generateAccessToken(payload);

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: userObj,
    });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email?.trim()?.toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          securityToken: resetToken,
          'otp.otpValue': resetToken,
          'otp.otpExpiry': expiresAt,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Reset token generated successfully',
      resetToken,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    let { securityToken, newPassword, confirmPassword } = req.body;
    securityToken = securityToken?.trim();
    newPassword = newPassword?.trim();
    confirmPassword = confirmPassword?.trim();

    if (!securityToken) {
      return res.status(400).json({
        success: false,
        message: 'securityToken is required',
      });
    }
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
      });
    }
    if (!confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password is required',
      });
    }

    if (!isPasswordValid(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must have at least one uppercase, one lowercase, one number, and one symbol (min 8 characters)',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password must be same as new password',
      });
    }

    const user = await User.findOne({ securityToken });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
      });
    }

    if (!user.otp?.otpExpiry || user.otp.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired',
      });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be same as old password',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashed,
          securityToken: '',
          'otp.otpValue': '',
          'otp.otpExpiry': null,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (err) {
    next(err);
  }
};

// Change password for logged-in user
const changeUserPassword = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    let { oldPassword, newPassword, confirmPassword } = req.body;

    oldPassword = oldPassword?.trim();
    newPassword = newPassword?.trim();
    confirmPassword = confirmPassword?.trim();

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'User account has been deleted',
      });
    }

    if (!oldPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password is required',
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
      });
    }

    if (!isPasswordValid(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must have at least one uppercase, one lowercase, one number, and one symbol (min 8 characters)',
      });
    }

    if (!confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password is required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password must be same as new password',
      });
    }

    const isOldMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isOldMatch) {
      return res.status(400).json({
        success: false,
        message: 'Old password is incorrect',
      });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be same as old password',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
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

// Admin: Get all Active users
const getAllActiveUsersByAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token?._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const users = await User.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .select('-password');

    return res.json({
      success: true,
      message: 'Active users fetched successfully',
      result: users,
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

// Admin: Get all Blocked users
const getAllBlockedUsersByAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token?._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const users = await User.find({ status: 'Blocked' })
      .sort({ createdAt: -1 })
      .select('-password');

    return res.json({
      success: true,
      message: 'Blocked users fetched successfully',
      result: users,
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

// Admin: Get single user by id
const getUserByIdByAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token?._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const user = await User.findById(id).select('-password').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      message: 'User fetched successfully',
      result: user,
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

// Admin: Get single ACTIVE user by id
const getActiveUserByIdByAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token?._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const user = await User.findOne({ _id: id, status: 'Active' }).select('-password').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Active user not found',
      });
    }

    return res.json({
      success: true,
      message: 'Active user fetched successfully',
      result: user,
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

// Admin: Get single BLOCKED user by id
const getBlockedUserByIdByAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token?._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const user = await User.findOne({ _id: id, status: 'Blocked' }).select('-password').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Blocked user not found',
      });
    }

    return res.json({
      success: true,
      message: 'Blocked user fetched successfully',
      result: user,
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

// 1. addGender – token se user validate, phir gender add/update
const addGender = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { gender } = req.body;

    if (!gender) {
      return res.status(400).json({
        success: false,
        message: 'gender is required',
      });
    }

    if (!['male', 'female', 'other'].includes(gender.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Valid gender is required (male, female, other)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.gender = gender.toLowerCase();
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Gender added/updated successfully',
      result,
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

// 2. addHeight – token se user validate, phir height add/update (inches ya feet + inches)
const addHeight = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { height, feet, inches } = req.body;

    let heightInches = height;
    if (height == null && feet != null && inches != null) {
      heightInches = Number(feet) * 12 + Number(inches);
    }

    if (heightInches == null || isNaN(heightInches) || heightInches < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid height is required (height in inches, or feet and inches)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.height = heightInches;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Height added/updated successfully',
      result,
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

// 3. addWeight – token se user validate, phir weight add/update (LBS)
const addWeight = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { weight } = req.body;

    if (!weight) {
      return res.status(400).json({
        success: false,
        message: 'weight is required',
      });
    }

    const weightNum = Number(weight);
    if (isNaN(weightNum) || weightNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid weight is required (in LBS)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.weight = weightNum;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Weight added/updated successfully',
      result,
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

// 4. addAge – token se user validate, phir age add/update
const addAge = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { age } = req.body;

    if (!age) {
      return res.status(400).json({
        success: false,
        message: 'age is required',
      });
    }

    const ageNum = Number(age);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Valid age is required (13–100)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.age = ageNum;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Age added/updated successfully',
      result,
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

// 5. addWorkoutSkillLevel – token se user validate, phir workout skill level add/update
const addWorkoutSkillLevel = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { workoutSkillLevel } = req.body;

    if (!workoutSkillLevel) {
      return res.status(400).json({
        success: false,
        message: 'workoutSkillLevel is required',
      });
    }

    const allowed = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
    const value = String(workoutSkillLevel).toUpperCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid workoutSkillLevel is required (BEGINNER, INTERMEDIATE, ADVANCED)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.workoutSkillLevel = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Workout skill level added/updated successfully',
      result,
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

// 6. addWorkoutPreferences – token se user validate, phir workout preferences add/update (one or more)
const addWorkoutPreferences = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { workoutPreferences } = req.body;

    if (!workoutPreferences) {
      return res.status(400).json({
        success: false,
        message: 'workoutPreferences is required',
      });
    }

    const allowed = ['CROSSFIT', 'PILATES', 'WEIGHTLIFTING', 'HIIT', 'YOGA'];
    const raw = Array.isArray(workoutPreferences) ? workoutPreferences : [workoutPreferences];
    const value = raw.map((p) => String(p).toUpperCase()).filter((p) => allowed.includes(p));
    if (value.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid workoutPreferences required (CROSSFIT, PILATES, WEIGHTLIFTING, HIIT, YOGA). Choose one or more.',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.workoutPreferences = value.join(',');
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Workout preferences added/updated successfully',
      result,
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

// 7. addFitnessTarget – token se user validate, phir fitness target add/update
const addFitnessTarget = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { fitnessTarget } = req.body;

    if (!fitnessTarget) {
      return res.status(400).json({
        success: false,
        message: 'fitnessTarget is required',
      });
    }

    const allowed = ['WEIGHTLOSS', 'MUSCLEGAIN', 'STRENGTH', 'GENRALFITNESS'];
    const value = String(fitnessTarget).toUpperCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid fitnessTarget is required (WEIGHTLOSS, MUSCLEGAIN, STRENGTH, GENRALFITNESS)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.fitnessTarget = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Fitness target added/updated successfully',
      result,
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

// 8. addFitnessGoal – token se user validate, phir weekly weight goal add/update (target weight change per week)
const addFitnessGoal = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { weeklyWeightGoal, calorieAdjustment } = req.body;

    if (!weeklyWeightGoal) {
      return res.status(400).json({
        success: false,
        message: 'weeklyWeightGoal is required',
      });
    }

    const allowed = ['lose_1', 'lose_0_5', 'maintain', 'gain_0_5', 'gain_1'];
    const value = String(weeklyWeightGoal).toLowerCase().replace(/\s/g, '_');
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid weeklyWeightGoal required (lose_1, lose_0_5, maintain, gain_0_5, gain_1)',
      });
    }

    const calorieMap = { lose_1: -500, lose_0_5: -250, maintain: 0, gain_0_5: 250, gain_1: 500 };
    const calAdjust = calorieAdjustment != null ? Number(calorieAdjustment) : calorieMap[value];

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.weeklyWeightGoal = value;
    user.calorieAdjustment = calAdjust;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Fitness goal added/updated successfully',
      result,
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

// 9. addTargetWeight – token se user validate, phir target weight add/update (Lbs)
const addTargetWeight = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { targetweight } = req.body;

    if (targetweight == null || targetweight === '') {
      return res.status(400).json({
        success: false,
        message: 'targetweight is required',
      });
    }

    const value = Number(targetweight);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid target weight is required (in Lbs)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.targetweight = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Target weight added/updated successfully',
      result,
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

// 10. addGoalDuration – token se user validate, phir goal duration add/update (8w, 12w, 16w, 24w)
const addGoalDuration = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { goalDuration } = req.body;

    if (!goalDuration) {
      return res.status(400).json({
        success: false,
        message: 'goalDuration is required',
      });
    }

    const allowed = ['8w', '12w', '16w', '24w'];
    const value = String(goalDuration).toLowerCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid goalDuration is required (8w, 12w, 16w, 24w)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.goalDuration = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Goal duration added/updated successfully',
      result,
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

// 11. addWorkoutFrequency – token se user validate, phir workout frequency add/update (3, 4, 5, 6 days/week)
const addWorkoutFrequency = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { workoutFrequency } = req.body;

    if (workoutFrequency == null || workoutFrequency === '') {
      return res.status(400).json({
        success: false,
        message: 'workoutFrequency is required',
      });
    }

    const value = Number(workoutFrequency);
    if (![3, 4, 5, 6].includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid workoutFrequency is required (3, 4, 5, or 6 days per week)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.workoutFrequency = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Workout frequency added/updated successfully',
      result,
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

// 12. addLastWorkout – token se user validate, phir last workout add/update
const addLastWorkout = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { lastWorkout } = req.body;

    if (!lastWorkout) {
      return res.status(400).json({
        success: false,
        message: 'lastWorkout is required',
      });
    }

    const allowed = ['last_week', 'last_month', 'last_6_months', 'never_or_over_a_year'];
    const value = String(lastWorkout).toLowerCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid lastWorkout is required (last_week, last_month, last_6_months, never_or_over_a_year)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.lastWorkout = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Last workout added/updated successfully',
      result,
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

// 13. addTrainingLocation – token se user validate, phir training location add/update (home/gym)
const addTrainingLocation = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const { trainingLocation } = req.body;

    if (!trainingLocation) {
      return res.status(400).json({
        success: false,
        message: 'trainingLocation is required',
      });
    }

    const allowed = ['home_workouts', 'gym_training'];
    const value = String(trainingLocation).toLowerCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message: 'Valid trainingLocation is required (home_workouts, gym_training)',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.trainingLocation = value;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'Training location added/updated successfully',
      result,
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
  signup,
  login,
  forgotPassword,
  resetPassword,
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
  changeUserPassword,
  getAllActiveUsersByAdmin,
  getAllBlockedUsersByAdmin,
  getUserByIdByAdmin,
  getActiveUserByIdByAdmin,
  getBlockedUserByIdByAdmin,
};
