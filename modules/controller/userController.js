const User = require('../model/userModel');
const WorkoutLog = require('../model/workoutLogModel');
const { Admin } = require('../model/adminModel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateAccessToken } = require('../../middleware/jwt');
const sendEmail = require('../service/mailService');
const { getResetPasswordTemplate } = require('../service/resetPasswordTemplate');
const { getSignupOtpTemplate } = require('../service/signupOtpTemplate');
const { verifyGoogleIdToken } = require('../service/googleAuthService');
const { syncPrimaryWeightGoal } = require('./userGoalController');
const {
  buildCalorieEngineResult,
  normalizeActivityFactorKey,
  normalizeWeeklyGoalKey,
  ALLOWED_ACTIVITY_FACTOR_KEYS,
  isProfileOnboardingComplete,
} = require('../../utils/calorieTargetHelpers');
const { isBlockedUser, sendBlockedUserResponse } = require('../../utils/userAccessGuards');

// Safe wrapper: dashboard goal sync must never break the profile-save flow.
// We log the error and continue so the user still sees their profile update.
const safeSyncWeightGoal = async (user) => {
  try {
    await syncPrimaryWeightGoal(user);
  } catch (e) {
    console.error('syncPrimaryWeightGoal failed:', e.message);
  }
};

const SIGNUP_OTP_TTL_MS = 15 * 60 * 1000;
const SIGNUP_OTP_RESEND_COOLDOWN_MS = 30 * 1000;

const generateSignupOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const buildSignupProfileUpdate = (body) => {
  const {
    gender,
    heightFeet,
    heightInches,
    height,
    weight,
    age,
    fitnessGoal,
    activityFactor,
    activity_factor,
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
    lastworkout: lastWorkoutFlat,
    traininglocation: trainingLocationFlat,
    lastWorkOut,
    training_Location,
  } = body;

  const lastWorkout = lastWorkoutBody ?? lastWorkoutSnake ?? lastWorkoutFlat ?? lastWorkOut;
  const trainingLocation =
    trainingLocationBody ?? trainingLocationSnake ?? trainingLocationFlat ?? training_Location;

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
      const calorieMap = { lose_1: -500, lose_0_5: -250, maintain: 0, gain_0_5: 250, gain_1: 500 };
      profileUpdate.calorieAdjustment = calorieMap[goalVal];
    }
  }

  const activityRaw = activityFactor ?? activity_factor;
  if (activityRaw != null && activityRaw !== '') {
    const activityKey = normalizeActivityFactorKey(activityRaw);
    if (activityKey) profileUpdate.activityFactor = activityKey;
  }

  if (workoutSkillLevel) {
    const wl = String(workoutSkillLevel).toUpperCase();
    const allowed = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
    if (allowed.includes(wl)) {
      profileUpdate.workoutSkillLevel = wl;
    }
  }

  if (workoutPreferences) {
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

  return profileUpdate;
};

const GOOGLE_SIGNUP_REQUIRED_FIELDS = [
  'gender',
  'age',
  'weight',
  'height',
  'activityFactor',
  'fitnessGoal',
  'targetweight',
  'goalDuration',
];

const validateGoogleSignupBody = (body) => {
  const missing = [];
  const errors = [];

  const gender = String(body?.gender || '').toLowerCase();
  if (!['male', 'female'].includes(gender)) {
    missing.push('gender');
  }

  if (body?.age == null || body?.age === '' || Number.isNaN(Number(body.age))) {
    missing.push('age');
  }

  if (body?.weight == null || body?.weight === '' || Number.isNaN(Number(body.weight))) {
    missing.push('weight');
  }

  const hasHeight =
    (body?.height != null && body?.height !== '' && !Number.isNaN(Number(body.height))) ||
    (body?.heightFeet != null && body?.heightInches != null);
  if (!hasHeight) {
    missing.push('height (or heightFeet + heightInches)');
  }

  const activityKey = normalizeActivityFactorKey(
    body?.activityFactor ?? body?.activity_factor
  );
  if (!activityKey) {
    missing.push('activityFactor');
  }

  const goalKey = normalizeWeeklyGoalKey(body?.fitnessGoal ?? body?.weeklyWeightGoal);
  const allowedGoals = ['lose_1', 'lose_0_5', 'maintain', 'gain_0_5', 'gain_1'];
  if (!goalKey || !allowedGoals.includes(goalKey)) {
    missing.push('fitnessGoal');
  }

  const targetRaw = body?.targetweight ?? body?.targetWeight;
  if (targetRaw == null || targetRaw === '' || Number.isNaN(Number(targetRaw))) {
    missing.push('targetweight');
  }

  const gd = String(body?.goalDuration || '').toLowerCase();
  const allowedGD = ['8w', '12w', '16w', '24w'];
  if (!allowedGD.includes(gd)) {
    missing.push('goalDuration');
  }

  if (body?.workoutFrequency != null && body?.workoutFrequency !== '') {
    const wf = Number(body.workoutFrequency);
    if (![3, 4, 5, 6].includes(wf)) {
      errors.push('workoutFrequency must be 3, 4, 5, or 6');
    }
  }

  if (body?.workoutSkillLevel) {
    const wl = String(body.workoutSkillLevel).toUpperCase();
    if (!['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(wl)) {
      errors.push('workoutSkillLevel must be BEGINNER, INTERMEDIATE, or ADVANCED');
    }
  }

  return { missing, errors, activityKey, goalKey };
};

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
    .replace(/[^a-z0-9_]/g, '')
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
  const rawValue = String(raw).trim();
  return rawValue || null;
};

const parseTrainingLocationSignup = (raw) => {
  if (raw == null || raw === '') return null;
  const rawValue = String(raw).trim();
  let v = toSnakeToken(rawValue);
  if (TRAINING_LOCATION_ALIASES[v]) v = TRAINING_LOCATION_ALIASES[v];
  const allowed = ['home_workouts', 'gym_training'];
  return allowed.includes(v) ? rawValue : null;
};

const buildPublicBaseUrl = (req) =>
  process.env.PUBLIC_BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;

const toPublicFileUrl = (req, storedPath) => {
  if (!storedPath) return '';
  const raw = String(storedPath).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/');
  const uploadsMarker = '/uploads/';
  const idx = normalized.toLowerCase().lastIndexOf(uploadsMarker);

  let publicPath = '';
  if (idx >= 0) {
    publicPath = normalized.slice(idx);
  } else {
    const fileName = normalized.split('/').filter(Boolean).pop();
    publicPath = fileName ? `/uploads/${fileName}` : '';
  }

  if (!publicPath) return '';
  return `${buildPublicBaseUrl(req)}${publicPath}`;
};

const attachProfilePhotoUrl = (req, data) => {
  if (!data || typeof data !== 'object') return data;
  const profilePhotoUrl = toPublicFileUrl(req, data.profilePhoto);
  const sanitized = { ...data };

  return {
    ...sanitized,
    profilePhoto: profilePhotoUrl,
  };
};

const enrichUserProfileResponse = (req, userObj) => {
  const base = attachProfilePhotoUrl(req, userObj);
  const engine = buildCalorieEngineResult(userObj);
  return {
    ...base,
    calculations: engine.calculations,
    goal_timeline_warning: engine.goal_timeline_warning,
    activity_factor: engine.activity_factor,
    activity_multiplier: engine.activity_multiplier,
    calorie_adjustment: engine.calorie_adjustment,
    calculatedFromProfile: engine.calculatedFromProfile,
  };
};

const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

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
      if (existingUser.status !== 'Pending') {
        return res.status(400).json({
          success: false,
          message: 'This email is already registered. Please sign in.',
          result: {},
        });
      }
    }

    const profileUpdate = buildSignupProfileUpdate(req.body);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateSignupOtp();
    const otpExpiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MS);
    const otpSentAt = new Date();
    const subject = process.env.SIGNUP_OTP_EMAIL_SUBJECT || 'Verify your Four Score account';

    if (existingUser) {
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            name: name.trim(),
            password: hashedPassword,
            ...profileUpdate,
            securityToken: '',
            'otp.otpValue': otp,
            'otp.otpExpiry': otpExpiresAt,
            'otp.otpSentAt': otpSentAt,
          },
          $unset: { signupOtp: '', signupOtpExpiry: '' },
        }
      );
      const afterSignup = await User.findById(existingUser._id);
      if (afterSignup) await safeSyncWeightGoal(afterSignup);
    } else {
      const created = await User.create({
        name: name.trim(),
        email: emailTrimmed,
        password: hashedPassword,
        status: 'Pending',
        ...profileUpdate,
        otp: { otpValue: otp, otpExpiry: otpExpiresAt, otpSentAt },
      });
      await safeSyncWeightGoal(created);
    }

    const mailResult = await sendEmail(
      subject,
      emailTrimmed,
      getSignupOtpTemplate(otp),
    );
    if (!mailResult) {
      return res.status(502).json({
        success: false,
        message: 'Could not send verification email. Please try again later.',
      });
    }

    const statusCode = existingUser ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      message: 'Verification code sent to your email',
      requiresEmailVerification: true,
      result: { email: emailTrimmed },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Same as signup, but returns OTP in the response (for app testing / QA).
 * Verify still via POST /api/user/verify-signup-otp
 */
const signupReturnOtp = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

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
      if (existingUser.status !== 'Pending') {
        return res.status(400).json({
          success: false,
          message: 'This email is already registered. Please sign in.',
          result: {},
        });
      }
    }

    const profileUpdate = buildSignupProfileUpdate(req.body);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateSignupOtp();
    const otpExpiresAt = new Date(Date.now() + SIGNUP_OTP_TTL_MS);
    const otpSentAt = new Date();

    if (existingUser) {
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            name: name.trim(),
            password: hashedPassword,
            ...profileUpdate,
            securityToken: '',
            'otp.otpValue': otp,
            'otp.otpExpiry': otpExpiresAt,
            'otp.otpSentAt': otpSentAt,
          },
          $unset: { signupOtp: '', signupOtpExpiry: '' },
        }
      );
      const afterSignup = await User.findById(existingUser._id);
      if (afterSignup) await safeSyncWeightGoal(afterSignup);
    } else {
      const created = await User.create({
        name: name.trim(),
        email: emailTrimmed,
        password: hashedPassword,
        status: 'Pending',
        ...profileUpdate,
        otp: { otpValue: otp, otpExpiry: otpExpiresAt, otpSentAt },
      });
      await safeSyncWeightGoal(created);
    }

    // Best-effort email — do not fail signup if mail is unavailable
    try {
      const subject = process.env.SIGNUP_OTP_EMAIL_SUBJECT || 'Verify your Four Score account';
      await sendEmail(subject, emailTrimmed, getSignupOtpTemplate(otp));
    } catch (mailErr) {
      console.warn('signupReturnOtp: email send skipped/failed:', mailErr?.message || mailErr);
    }

    const statusCode = existingUser ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      message: 'Verification code generated. Use OTP from response to verify.',
      requiresEmailVerification: true,
      result: {
        email: emailTrimmed,
        otp,
        otpExpiresAt: otpExpiresAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

const resendSignupOtp = async (req, res, next) => {
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

    if (user.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified. Please sign in.',
      });
    }

    const lastSentAt = user?.otp?.otpSentAt ? new Date(user.otp.otpSentAt) : null;
    const now = Date.now();
    if (lastSentAt) {
      const elapsedMs = now - lastSentAt.getTime();
      if (elapsedMs < SIGNUP_OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (SIGNUP_OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds}s before requesting a new code.`,
          retryAfterSeconds,
        });
      }
    }

    const otp = generateSignupOtp();
    const otpExpiresAt = new Date(now + SIGNUP_OTP_TTL_MS);
    const otpSentAt = new Date(now);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          'otp.otpValue': otp,
          'otp.otpExpiry': otpExpiresAt,
          'otp.otpSentAt': otpSentAt,
        },
      }
    );

    const subject = process.env.SIGNUP_OTP_EMAIL_SUBJECT || 'Verify your Four Score account';
    const mailResult = await sendEmail(subject, email, getSignupOtpTemplate(otp));
    if (!mailResult) {
      return res.status(502).json({
        success: false,
        message: 'Could not send verification email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification code resent to your email',
      retryAfterSeconds: Math.ceil(SIGNUP_OTP_RESEND_COOLDOWN_MS / 1000),
      result: { email },
    });
  } catch (err) {
    next(err);
  }
};

const verifySignupOtp = async (req, res, next) => {
  try {
    let { email, otp } = req.body;
    email = email?.trim()?.toLowerCase();
    otp = String(otp ?? '').trim();

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
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

    if (user.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified. Please sign in.',
      });
    }

    // Move legacy BSON keys (if any) into `otp`, then read from `otp` only.
    let effectiveUser = user;
    const rawOtp = await User.collection.findOne(
      { _id: user._id },
      { projection: { signupOtp: 1, signupOtpExpiry: 1 } }
    );
    if (rawOtp?.signupOtp && rawOtp?.signupOtpExpiry) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'otp.otpValue': String(rawOtp.signupOtp).trim(),
            'otp.otpExpiry': rawOtp.signupOtpExpiry,
          },
          $unset: { signupOtp: '', signupOtpExpiry: '' },
        }
      );
      effectiveUser = await User.findById(user._id);
    }

    const otpExpiry = effectiveUser?.otp?.otpExpiry;
    const storedCode = String(effectiveUser?.otp?.otpValue || '').trim();

    if (!otpExpiry || otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Sign up again to receive a new code.',
      });
    }

    if (storedCode !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          status: 'Active',
          'otp.otpValue': '',
          'otp.otpExpiry': null,
        },
        $unset: { signupOtp: '', signupOtpExpiry: '' },
      }
    );

    const fresh = await User.findById(user._id);
    if (fresh) await safeSyncWeightGoal(fresh);

    const payload = { _id: fresh._id, email: fresh.email };
    const token = generateAccessToken(payload);
    const userObj = fresh.toObject();
    delete userObj.password;

    return res.status(200).json({
      success: true,
      message: 'Email verified. Account activated.',
      token,
      data: attachProfilePhotoUrl(req, userObj),
    });
  } catch (err) {
    next(err);
  }
};

const verifyGoogleAuthRequest = async (req) => {
  const { idToken } = req.body || {};

  if (!idToken || !String(idToken).trim()) {
    return {
      error: {
        status: 400,
        body: { success: false, message: 'idToken is required' },
      },
    };
  }

  if (!process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_IDS) {
    return {
      error: {
        status: 500,
        body: {
          success: false,
          message: 'Google auth is not configured on server (GOOGLE_CLIENT_ID)',
        },
      },
    };
  }

  try {
    const googleUser = await verifyGoogleIdToken(String(idToken).trim());
    return { googleUser };
  } catch (err) {
    return {
      error: {
        status: 401,
        body: {
          success: false,
          message: err.message || 'Invalid Google token',
          code: err.code,
        },
      },
    };
  }
};

// POST /api/user/auth/google/signup — first-time Google users (full onboarding required)
const googleSignup = async (req, res, next) => {
  try {
    const auth = await verifyGoogleAuthRequest(req);
    if (auth.error) {
      return res.status(auth.error.status).json(auth.error.body);
    }

    const { googleId, email, name: googleName, picture } = auth.googleUser;
    const validation = validateGoogleSignupBody(req.body);

    if (validation.missing.length) {
      return res.status(400).json({
        success: false,
        message: 'Complete onboarding profile is required for Google signup',
        missing_fields: validation.missing,
        required_fields: GOOGLE_SIGNUP_REQUIRED_FIELDS,
      });
    }

    if (validation.errors.length) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join('; '),
      });
    }

    const existing = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (existing?.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
      });
    }

    if (existing) {
      if (existing.googleId) {
        return res.status(400).json({
          success: false,
          message: 'Account already exists. Use Google login instead.',
          code: 'GOOGLE_ACCOUNT_EXISTS',
          login_endpoint: '/api/user/auth/google',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Sign in with email and password.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }

    const profileUpdate = buildSignupProfileUpdate(req.body);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), salt);
    const displayName = req.body.name?.trim() || googleName || email.split('@')[0];

    const user = await User.create({
      name: displayName,
      email,
      password: hashedPassword,
      googleId,
      authProvider: 'google',
      profilePhoto: picture || '',
      status: 'Active',
      ...profileUpdate,
    });
    await safeSyncWeightGoal(user);

    const payload = { _id: user._id, email: user.email };
    const token = generateAccessToken(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return res.status(201).json({
      success: true,
      message: 'Google signup successful',
      isNewUser: true,
      requiresOnboarding: false,
      token,
      data: enrichUserProfileResponse(req, userObj),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/user/auth/google — returning Google users (login only)
const googleAuth = async (req, res, next) => {
  try {
    const auth = await verifyGoogleAuthRequest(req);
    if (auth.error) {
      return res.status(auth.error.status).json(auth.error.body);
    }

    const { googleId, email, name: googleName, picture } = auth.googleUser;
    const profileUpdate = buildSignupProfileUpdate(req.body);

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found. Complete Google signup with your profile details first.',
        code: 'GOOGLE_SIGNUP_REQUIRED',
        signup_endpoint: '/api/user/auth/google/signup',
        required_fields: GOOGLE_SIGNUP_REQUIRED_FIELDS,
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
      });
    }

    if (user.status === 'Blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.',
      });
    }

    if (user.googleId && user.googleId !== googleId) {
      return res.status(400).json({
        success: false,
        message: 'This email is linked to a different Google account',
      });
    }

    if (!user.googleId) {
      if (user.authProvider === 'local' && user.status === 'Active') {
        return res.status(400).json({
          success: false,
          message: 'This email is registered with password. Sign in with email/password.',
          code: 'EMAIL_PASSWORD_ACCOUNT',
        });
      }
      user.googleId = googleId;
      user.authProvider = 'google';
    }

    if (user.status === 'Pending') {
      user.status = 'Active';
      user.otp = { otpValue: '', otpExpiry: null, otpSentAt: null };
    }

    if (!user.name?.trim()) {
      user.name = req.body.name?.trim() || googleName || user.name;
    }
    if (!user.profilePhoto?.trim() && picture) {
      user.profilePhoto = picture;
    }

    if (Object.keys(profileUpdate).length) {
      Object.assign(user, profileUpdate);
    }

    await user.save();
    await safeSyncWeightGoal(user);

    const onboardingComplete = isProfileOnboardingComplete(user);

    const payload = { _id: user._id, email: user.email };
    const token = generateAccessToken(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({
      success: true,
      message: onboardingComplete
        ? 'Google sign-in successful'
        : 'Google sign-in successful — complete your profile',
      isNewUser: false,
      requiresOnboarding: !onboardingComplete,
      token,
      data: enrichUserProfileResponse(req, userObj),
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

    if (user.status === 'Pending') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email with the code we sent you before signing in.',
      });
    }

    if (user.status === 'Blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'This account has been deleted',
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
      data: attachProfilePhotoUrl(req, userObj),
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

    if (user.status === 'Blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.',
      });
    }

    if (user.status === 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email with the code sent at signup before using forgot password.',
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

    const resetBaseUrl =
      process.env.USER_RESET_PASSWORD_URL ||
      process.env.FRONTEND_RESET_PASSWORD_URL ||
      'https://for-score-frontend.vercel.app/reset-password';
    const resetLink = `${resetBaseUrl}?token=${encodeURIComponent(resetToken)}`;

    const subject = process.env.USER_RESET_EMAIL_SUBJECT || 'Reset your password';
    const mailed = await sendEmail(
      subject,
      user.email,
      getResetPasswordTemplate(resetLink),
    );
    if (!mailed) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            securityToken: '',
            'otp.otpValue': '',
            'otp.otpExpiry': null,
          },
        },
      ).catch(() => {});
      return res.status(502).json({
        success: false,
        message: 'Could not send reset email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reset link sent to your email',
      expiresAt,
      result: {
        resetLink,
      },
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

    if (user.status === 'Blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.',
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

const getUserProfile = async (req, res, next) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id).select('-password');
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

    return res.status(200).json({
      success: true,
      message: 'User profile fetched successfully',
      data: enrichUserProfileResponse(req, user.toObject()),
    });
  } catch (err) {
    next(err);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const token = req.token;
    const user_id = token?._id;
    const body = req.body || {};

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

    if (isBlockedUser(user)) {
      return sendBlockedUserResponse(res);
    }

    if (body.name != null && body.name !== '') {
      user.name = String(body.name).trim();
    }

    if (body.email != null && body.email !== '') {
      const emailTrimmed = String(body.email).trim().toLowerCase();
      const existingUser = await User.findOne({ email: emailTrimmed, _id: { $ne: user_id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another user',
        });
      }
      user.email = emailTrimmed;
    }

    if (body.gender != null && body.gender !== '') {
      user.gender = String(body.gender).trim();
    }

    if (body.age != null && body.age !== '' && !Number.isNaN(Number(body.age))) {
      user.age = Number(body.age);
    }

    let heightVal = body.height;
    if ((heightVal == null || heightVal === '') && (body.heightFeet != null || body.heightInches != null)) {
      const ft = Number(body.heightFeet || 0);
      const inch = Number(body.heightInches || 0);
      if (!Number.isNaN(ft) && !Number.isNaN(inch)) {
        heightVal = ft * 12 + inch;
      }
    }
    if (heightVal != null && heightVal !== '' && !Number.isNaN(Number(heightVal))) {
      user.height = Number(heightVal);
    }

    if (body.weight != null && body.weight !== '' && !Number.isNaN(Number(body.weight))) {
      user.weight = Number(body.weight);
    }

    if (body.workoutSkillLevel != null && body.workoutSkillLevel !== '') {
      user.workoutSkillLevel = String(body.workoutSkillLevel).trim();
    }

    if (body.workoutPreferences != null && body.workoutPreferences !== '') {
      user.workoutPreferences = Array.isArray(body.workoutPreferences)
        ? body.workoutPreferences.map((v) => String(v).trim()).join(',')
        : String(body.workoutPreferences).trim();
    }

    if (body.workoutDuration != null && body.workoutDuration !== '' && !Number.isNaN(Number(body.workoutDuration))) {
      user.workoutDuration = Number(body.workoutDuration);
    }

    if (body.fitnessTarget != null && body.fitnessTarget !== '') {
      user.fitnessTarget = String(body.fitnessTarget).trim();
    }

    const targetWeightRaw = body.targetweight ?? body.targetWeight;
    if (targetWeightRaw != null && targetWeightRaw !== '' && !Number.isNaN(Number(targetWeightRaw))) {
      user.targetweight = Number(targetWeightRaw);
    }

    if (body.goalDuration != null && body.goalDuration !== '') {
      user.goalDuration = String(body.goalDuration).trim();
    }

    if (body.workoutFrequency != null && body.workoutFrequency !== '' && !Number.isNaN(Number(body.workoutFrequency))) {
      user.workoutFrequency = Number(body.workoutFrequency);
    }

    const lastWorkoutRaw =
      body.lastWorkout ?? body.last_workout ?? body.lastworkout ?? body.lastWorkOut;
    if (lastWorkoutRaw != null && String(lastWorkoutRaw).trim() !== '') {
      user.lastWorkout = String(lastWorkoutRaw).trim();
    }

    const trainingLocationRaw =
      body.trainingLocation ?? body.training_location ?? body.traininglocation ?? body.training_Location;
    if (trainingLocationRaw != null && String(trainingLocationRaw).trim() !== '') {
      user.trainingLocation = String(trainingLocationRaw).trim();
    }

    const weeklyWeightGoalRaw = body.weeklyWeightGoal ?? body.fitnessGoal;
    if (weeklyWeightGoalRaw != null && weeklyWeightGoalRaw !== '') {
      user.weeklyWeightGoal = String(weeklyWeightGoalRaw).trim();
    }

    if (body.calorieAdjustment != null && body.calorieAdjustment !== '' && !Number.isNaN(Number(body.calorieAdjustment))) {
      user.calorieAdjustment = Number(body.calorieAdjustment);
    }

    const activityRaw = body.activityFactor ?? body.activity_factor;
    if (activityRaw != null && activityRaw !== '') {
      const activityKey = normalizeActivityFactorKey(activityRaw);
      if (!activityKey) {
        return res.status(400).json({
          success: false,
          message: `Valid activityFactor required (${ALLOWED_ACTIVITY_FACTOR_KEYS.join(', ')})`,
        });
      }
      user.activityFactor = activityKey;
    }

    await user.save();
    // Keep the auto-managed primary weight goal in sync with profile changes.
    await safeSyncWeightGoal(user);

    const result = user.toObject();
    delete result.password;

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: enrichUserProfileResponse(req, result),
    });
  } catch (err) {
    next(err);
  }
};

const getCalorieCalculations = async (req, res, next) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id).select('-password').lean();
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

    const engine = buildCalorieEngineResult(user);

    return res.status(200).json({
      success: true,
      message: 'Calorie calculations fetched successfully',
      result: engine,
    });
  } catch (err) {
    next(err);
  }
};

const updateProfilePhoto = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile photo is required',
      });
    }

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

    user.profilePhoto = toPublicFileUrl(req, req.file.path) || req.file.path;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: attachProfilePhotoUrl(req, result),
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

    if (isBlockedUser(user)) {
      return sendBlockedUserResponse(res);
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
      .select('-password')
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const sessionRows = await WorkoutLog.aggregate([
      {
        $match: {
          status: { $ne: 'Deleted' },
          date: { $gte: todayStart, $lt: todayEnd },
        },
      },
      { $group: { _id: '$userId', sessionsToday: { $sum: 1 } } },
    ]);
    const sessionsByUserId = new Map(
      sessionRows.map((row) => [String(row._id), row.sessionsToday])
    );

    return res.json({
      success: true,
      message: 'Active users fetched successfully',
      result: users.map((u) => {
        const obj = attachProfilePhotoUrl(req, { ...u });
        const sessionsToday = sessionsByUserId.get(String(u._id));
        return {
          ...obj,
          sessionsToday: typeof sessionsToday === 'number' ? sessionsToday : 0,
        };
      }),
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
      result: users.map((u) => attachProfilePhotoUrl(req, u.toObject())),
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
      result: attachProfilePhotoUrl(req, user),
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const sessionsToday = await WorkoutLog.countDocuments({
      userId: user._id,
      status: { $ne: 'Deleted' },
      date: { $gte: todayStart, $lt: todayEnd },
    });

    return res.json({
      success: true,
      message: 'Active user fetched successfully',
      result: {
        ...attachProfilePhotoUrl(req, user),
        sessionsToday,
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
      result: attachProfilePhotoUrl(req, user),
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
    await safeSyncWeightGoal(user);

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

    const allowed = [
      'CROSSFIT',
      'PILATES',
      'WEIGHTLIFTING',
      'HIIT',
      'YOGA',
      'FUNCTIONALMOVEMENT',
      'FUNCTIONAL_MOVEMENT',
      'QUICKIES',
      'PRENATAL',
      'POSTPARTUM',
      'PRENATAL/POSTPARTUM',
      'PRENATAL_POSTPARTUM',
    ];
    const raw = Array.isArray(workoutPreferences) ? workoutPreferences : [workoutPreferences];
    const value = raw.map((p) => String(p).toUpperCase()).filter((p) => allowed.includes(p));
    if (value.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Valid workoutPreferences required (CROSSFIT, PILATES, WEIGHTLIFTING, HIIT, YOGA, FUNCTIONALMOVEMENT, QUICKIES, PRENATAL/POSTPARTUM). Choose one or more.',
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

    const allowed = ['WEIGHTLOSS', 'MUSCLEGAIN', 'STRENGTH', 'GENRALFITNESS', 'GENERALFITNESS'];
    const value = String(fitnessTarget).toUpperCase();
    if (!allowed.includes(value)) {
      return res.status(400).json({
        success: false,
        message:
          'Valid fitnessTarget is required (WEIGHTLOSS, MUSCLEGAIN, STRENGTH, GENERALFITNESS)',
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
    await safeSyncWeightGoal(user);

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

// 8a. addActivityFactor – Harris-Benedict activity tier (sedentary → extra_active)
const addActivityFactor = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token._id;
    const raw = req.body?.activityFactor ?? req.body?.activity_factor;

    if (raw == null || raw === '') {
      return res.status(400).json({
        success: false,
        message: 'activityFactor is required',
      });
    }

    const value = normalizeActivityFactorKey(raw);
    if (!value) {
      return res.status(400).json({
        success: false,
        message: `Valid activityFactor required (${ALLOWED_ACTIVITY_FACTOR_KEYS.join(', ')})`,
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.activityFactor = value;
    await user.save();

    const result = user.toObject();
    delete result.password;
    const engine = buildCalorieEngineResult(result);

    return res.json({
      success: true,
      message: 'Activity factor added/updated successfully',
      result: {
        ...result,
        calculations: engine.calculations,
        goal_timeline_warning: engine.goal_timeline_warning,
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

    const engine = buildCalorieEngineResult(result);

    return res.json({
      success: true,
      message: 'Fitness goal added/updated successfully',
      result: {
        ...result,
        calculations: engine.calculations,
        goal_timeline_warning: engine.goal_timeline_warning,
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
    await safeSyncWeightGoal(user);

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

// 14. saveOneSignalPlayerId – token se user validate, phir OneSignal player id save/update
const saveOneSignalPlayerId = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;
    const { playerId } = req.body;

    if (!playerId || !String(playerId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required',
      });
    }

    const value = String(playerId).trim();
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    user.oneSignalPlayerId = value;
    const existing = Array.isArray(user.oneSignalPlayerIds)
      ? user.oneSignalPlayerIds.map((id) => String(id))
      : [];
    if (!existing.includes(value)) {
      existing.push(value);
    }
    user.oneSignalPlayerIds = existing;
    await user.save();

    const result = user.toObject();
    delete result.password;

    return res.json({
      success: true,
      message: 'OneSignal player id saved successfully',
      result: {
        oneSignalPlayerId: result.oneSignalPlayerId,
        oneSignalPlayerIds: result.oneSignalPlayerIds,
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

module.exports = {
  signup,
  signupReturnOtp,
  verifySignupOtp,
  resendSignupOtp,
  googleAuth,
  googleSignup,
  login,
  forgotPassword,
  resetPassword,
  getUserProfile,
  getCalorieCalculations,
  updateUserProfile,
  updateProfilePhoto,
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
  changeUserPassword,
  getAllActiveUsersByAdmin,
  getAllBlockedUsersByAdmin,
  getUserByIdByAdmin,
  getActiveUserByIdByAdmin,
  getBlockedUserByIdByAdmin,
};
