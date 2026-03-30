const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const bcrypt = require('bcryptjs');
const { generateAccessToken } = require('../../middleware/jwt');
const crypto = require('crypto');

const isPasswordValid = (password) => {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
};

// ----------------- Admin Forgot/Reset Password -----------------

// 1) Forgot password: generate a reset token for given email
const forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    email = email?.trim()?.toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        result: {},
      });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    admin.securityToken = resetToken;
    admin.otp.otpValue = resetToken; // reuse existing otp field
    admin.otp.otpExpiry = expiresAt;
    await admin.save();

    // Note: in production, token should be emailed. For now we return it for testing.
    return res.status(200).json({
      success: true,
      message: 'Reset token generated successfully',
      result: { resetToken, expiresAt },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

// 2) Reset password: verify reset token + update password
const resetPassword = async (req, res) => {
  try {
    let { securityToken, newPassword, confirmPassword } = req.body;
    securityToken = securityToken?.trim();
    newPassword = newPassword?.trim();
    confirmPassword = confirmPassword?.trim();

    if (!securityToken) {
      return res.status(400).json({
        success: false,
        message: 'securityToken is required',
        result: {},
      });
    }
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
        result: {},
      });
    }
    if (!confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password is required',
        result: {},
      });
    }

    if (!isPasswordValid(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must have at least one uppercase, one lowercase, one number, and one symbol (min 8 characters)',
        result: {},
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password must be same as new password',
        result: {},
      });
    }

    const admin = await Admin.findOne({ securityToken });
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    if (!admin.otp?.otpExpiry || admin.otp.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired',
        result: {},
      });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, admin.password);
    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be same as old password',
        result: {},
      });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.securityToken = '';
    admin.otp.otpValue = '';
    admin.otp.otpExpiry = null;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      result: {},
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailTrimmed = email?.trim()?.toLowerCase();
    const passwordTrimmed = password?.trim();

    if (!emailTrimmed) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        result: {},
      });
    }
    if (!passwordTrimmed) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
        result: {},
      });
    }

    const admin = await Admin.findOne({ email: emailTrimmed });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const isMatch = await bcrypt.compare(passwordTrimmed, admin.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Password mismatch',
        result: {},
      });
    }

    const accessToken = generateAccessToken({
      _id: admin._id,
      email: admin.email,
      role: 'admin',
    });

    admin.accesstoken = accessToken;
    await admin.save();

    const result = admin.toObject();
    delete result.password;
    delete result.refreshtoken;

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      result: { ...result, token: accessToken },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const logoutAdmin = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    admin.accesstoken = '';
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Admin logout successfully',
      result: {},
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;
    let { oldPassword, newPassword, confirmPassword } = req.body;

    oldPassword = oldPassword?.trim();
    newPassword = newPassword?.trim();
    confirmPassword = confirmPassword?.trim();

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Unauthorized access',
        result: {},
      });
    }

    if (!oldPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password is required',
        result: {},
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
        result: {},
      });
    }

    if (!isPasswordValid(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must have at least one uppercase, one lowercase, one number, and one symbol (min 8 characters)',
        result: {},
      });
    }

    if (!confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password is required',
        result: {},
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password must be same as new password',
        result: {},
      });
    }

    const isOldMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isOldMatch) {
      return res.status(400).json({
        success: false,
        message: 'Old password is incorrect',
        result: {},
      });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, admin.password);
    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be same as old password',
        result: {},
      });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      result: {},
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id).select('-password -accesstoken -refreshtoken');
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
        result: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin profile fetched successfully',
      result: admin,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;
    const { fullName, email } = req.body;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    if (fullName != null && fullName !== '') {
      admin.fullName = fullName.trim();
    }
    if (email != null && email !== '') {
      const emailTrimmed = email.trim().toLowerCase();
      const existing = await Admin.findOne({ email: emailTrimmed, _id: { $ne: admin_id } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another admin',
          result: {},
        });
      }
      admin.email = emailTrimmed;
    }

    await admin.save();

    const result = admin.toObject();
    delete result.password;
    delete result.accesstoken;
    delete result.refreshtoken;

    return res.status(200).json({
      success: true,
      message: 'Admin profile updated successfully',
      result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { email: regex }];
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'blocked') query.status = 'Blocked';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      result: {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const getUserStats = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const [total, active, blocked] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'Active' }),
      User.countDocuments({ status: 'Blocked' }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'User stats fetched successfully',
      result: { total, active, blocked },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;
    const { id } = req.params;
    const { status } = req.body;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    if (!status || !['Active', 'Blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (Active or Blocked)',
        result: {},
      });
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        result: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      result: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;
    const { id } = req.params;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const user = await User.findByIdAndUpdate(id, { status: 'Deleted' }, { new: true }).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        result: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      result: user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      result: {},
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;
    const { id } = req.params;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
        result: {},
      });
    }

    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
        result: {},
      });
    }

    const user = await User.findById(id).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        result: {},
      });
    }

    return res.status(200).json({
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
      result: {},
    });
  }
};

module.exports = {
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
};
