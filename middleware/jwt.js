const jwt = require('jsonwebtoken');
require('dotenv').config();

const { User } = require('../modules/model/userModel');
const { Admin } = require('../modules/model/adminModel');

// Access Token generate (short expiry)
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '60days',
  });
};

// Refresh Token generate (long expiry)
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

// Verify Access Token middleware
// Also enforces account status:
// - Blocked users cannot access protected endpoints.
// - Deleted users/admins are rejected.
const verifyAccessToken = async (req, res, next) => {
  try {
    const incomingToken = req.headers.token;
    if (!incomingToken) {
      return res.send({
        statusCode: 401,
        success: false,
        message: 'Token not Found',
        result: {},
      });
    }

    const decoded = jwt.verify(incomingToken, process.env.JWT_ACCESS_SECRET);
    if (!decoded) {
      return res.send({
        statusCode: 401,
        success: false,
        message: 'Unauthorized Access, Please login',
        result: {},
      });
    }

    req.token = decoded;

    // Enforce blocked/deleted accounts at a single choke-point.
    // Token payload:
    // - user login: { _id, email }
    // - admin login: { _id, email, role: 'admin' }
    const subjectId = decoded?._id;
    if (!subjectId) {
      return res.status(401).send({
        statusCode: 401,
        success: false,
        message: 'Unauthorized Access (missing subject)',
        result: {},
      });
    }

    if (decoded?.role === 'admin') {
      const admin = await Admin.findById(subjectId).select('status').lean();
      if (!admin || admin.status === 'Deleted') {
        return res.status(403).send({
          statusCode: 403,
          success: false,
          message: 'Admin account is not allowed',
          result: {},
        });
      }
    } else {
      const user = await User.findById(subjectId).select('status').lean();
      if (!user) {
        return res.status(401).send({
          statusCode: 401,
          success: false,
          message: 'Unauthorized Access (user not found)',
          result: {},
        });
      }
      if (user.status === 'Blocked') {
        return res.status(403).send({
          statusCode: 403,
          success: false,
          message: 'Your account is blocked. Please contact support.',
          result: {},
        });
      }
      if (user.status === 'Deleted') {
        return res.status(403).send({
          statusCode: 403,
          success: false,
          message: 'Your account has been deleted',
          result: {},
        });
      }
    }
    next();
  } catch (error) {
    return res.send({
      statusCode: 401,
      success: false,
      message: error.message + ' ERROR in verifyAccessToken',
      result: {},
    });
  }
};

// Verify Refresh Token (for new access token)
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
