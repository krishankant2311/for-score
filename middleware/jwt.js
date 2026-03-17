const jwt = require('jsonwebtoken');
require('dotenv').config();

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
const verifyAccessToken = (req, res, next) => {
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
