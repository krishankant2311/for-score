const BLOCKED_USER_MESSAGE = 'Your account is blocked. Please contact support.';

const isBlockedUser = (user) => user?.status === 'Blocked';

const sendBlockedUserResponse = (res) =>
  res.status(403).json({
    success: false,
    message: BLOCKED_USER_MESSAGE,
  });

module.exports = {
  BLOCKED_USER_MESSAGE,
  isBlockedUser,
  sendBlockedUserResponse,
};
