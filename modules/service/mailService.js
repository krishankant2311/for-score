const https = require('https');
const sgMail = require('@sendgrid/mail');
const { Client } = require('@sendgrid/client');
const nodemailer = require('nodemailer');
require('dotenv').config();

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return defaultValue;
};

const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
const mailFrom = (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();

const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure = toBool(process.env.SMTP_SECURE, smtpPort === 465);
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || process.env.MAIL_PASSWORD || '')
  .trim()
  .replace(/\s/g, '');

const emailProvider = String(process.env.EMAIL_PROVIDER || 'sendgrid').trim().toLowerCase();

const configureSendGrid = () => {
  if (!sendgridApiKey) return false;

  const client = new Client();
  client.setApiKey(sendgridApiKey);

  const rejectUnauthorized = toBool(process.env.SENDGRID_TLS_REJECT_UNAUTHORIZED, true);
  client.setDefaultRequest(
    'httpsAgent',
    new https.Agent({
      rejectUnauthorized,
      minVersion: 'TLSv1.2',
    })
  );

  sgMail.setClient(client);
  return true;
};

const sendViaSendGrid = async (sub, to, html) => {
  if (!configureSendGrid()) {
    console.log('❌ Email: SENDGRID_API_KEY is missing');
    return false;
  }
  if (!mailFrom) {
    console.log('❌ Email: MAIL_FROM is missing');
    return false;
  }

  const msg = {
    from: { name: 'Four Score', email: mailFrom },
    to,
    subject: sub,
    html,
  };

  const [response] = await sgMail.send(msg);
  return response;
};

let smtpTransporter = null;
const getSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;
  if (!smtpUser || !smtpPass) return null;

  smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
    tls: {
      rejectUnauthorized: toBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
      minVersion: 'TLSv1.2',
    },
  });
  return smtpTransporter;
};

const sendViaSmtp = async (sub, to, html) => {
  const transport = getSmtpTransporter();
  const from = mailFrom || smtpUser;
  if (!transport) {
    console.log('❌ Email: SMTP_USER / SMTP_PASS not configured');
    return false;
  }
  if (!from) {
    console.log('❌ Email: MAIL_FROM or SMTP_USER is missing');
    return false;
  }

  const info = await transport.sendMail({
    from: `"Four Score" <${from}>`,
    to,
    subject: sub,
    html,
  });
  return info;
};

/**
 * Sends email via SendGrid (default) or Gmail/SMTP when EMAIL_PROVIDER=smtp.
 */
const sendEmail = async (sub, to, html) => {
  const useSmtp =
    emailProvider === 'smtp' ||
    emailProvider === 'gmail' ||
    (!sendgridApiKey && smtpUser && smtpPass);

  try {
    if (useSmtp) {
      const result = await sendViaSmtp(sub, to, html);
      if (!result) return false;
      console.log(`✅ Email sent (SMTP) → ${to}`);
      return result;
    }

    const result = await sendViaSendGrid(sub, to, html);
    if (!result) return false;
    console.log(`✅ Email sent (SendGrid) → ${to}`);
    return result;
  } catch (error) {
    const sgBody = error?.response?.body;
    const details = sgBody || error?.message || error;
    console.log('❌ Email send failed:', details);

    if (!useSmtp && smtpUser && smtpPass) {
      console.log('↪ Retrying with SMTP fallback…');
      try {
        const fallback = await sendViaSmtp(sub, to, html);
        if (fallback) {
          console.log(`✅ Email sent (SMTP fallback) → ${to}`);
          return fallback;
        }
      } catch (smtpErr) {
        console.log('❌ SMTP fallback failed:', smtpErr?.message || smtpErr);
      }
    }

    return false;
  }
};

module.exports = sendEmail;
