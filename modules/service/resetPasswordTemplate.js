const getResetPasswordTemplate = (resetLink) => `
  <p>We received a request to reset your password.</p>
  <p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">Reset Password</a></p>
  <p>This link is valid for 15 minutes.</p>
  <p>If you did not request this, please ignore this email.</p>
`;

module.exports = {
  getResetPasswordTemplate,
};
