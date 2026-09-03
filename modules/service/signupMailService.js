const sendEmail = require('./mailService');
const { getSignupOtpTemplate } = require('./signupOtpTemplate');

const signupOtpSubject = () =>
  process.env.SIGNUP_OTP_EMAIL_SUBJECT || 'Verify your Four Score account';

/**
 * Send signup verification OTP via Nodemailer/SMTP (or SendGrid when configured).
 * @returns {Promise<boolean>} true when provider accepted the message
 */
const sendSignupVerificationEmail = async (email, otp) => {
  const to = String(email || '')
    .trim()
    .toLowerCase();
  const code = String(otp ?? '').trim();
  if (!to || !code) return false;

  const result = await sendEmail(signupOtpSubject(), to, getSignupOtpTemplate(code));
  if (result) {
    console.log(`✅ Signup OTP email sent → ${to}`);
  } else {
    console.log(`❌ Signup OTP email failed → ${to}`);
  }
  return Boolean(result);
};

module.exports = {
  sendSignupVerificationEmail,
  signupOtpSubject,
};
