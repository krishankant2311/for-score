/**
 * Test Nodemailer/SMTP email delivery.
 * Usage: node scripts/testEmail.js you@example.com [otp|reset]
 */
require('dotenv').config();
const sendEmail = require('../modules/service/mailService');
const { verifySmtpConnection } = require('../modules/service/mailService');
const { sendSignupVerificationEmail } = require('../modules/service/signupMailService');
const { getResetPasswordTemplate } = require('../modules/service/resetPasswordTemplate');

async function main() {
  const to = (process.argv[2] || '').trim();
  const mode = (process.argv[3] || 'otp').trim().toLowerCase();

  if (!to) {
    console.log('Usage: node scripts/testEmail.js <email> [otp|reset]');
    process.exit(1);
  }

  const verify = await verifySmtpConnection();
  console.log('SMTP verify:', verify.message);

  if (mode === 'reset') {
    const link = 'https://for-score-frontend.vercel.app/reset-password?token=test-token';
    const ok = await sendEmail('Test reset password email', to, getResetPasswordTemplate(link));
    process.exit(ok ? 0 : 1);
  }

  const ok = await sendSignupVerificationEmail(to, '123456');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
