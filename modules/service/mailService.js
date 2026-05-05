const dns = require('dns').promises;
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Render blocks outbound SMTP (465/587) → use Resend over HTTPS (443).
 *
 * Render dashboard → Environment:
 *   RESEND_API_KEY=re_...
 *   MAIL_FROM=Four Score <noreply@your-verified-domain.com>
 *
 * Free Resend: verify a domain, or test with onboarding@resend.dev (delivery limits apply).
 */

const isRenderDeploy = Boolean(
  process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_SERVICE_NAME ||
    process.env.RENDER,
);

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing');
  }

  const from =
    process.env.MAIL_FROM?.trim() ||
    'Four Score <onboarding@resend.dev>';

  const payload = {
    from,
    to: [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(!html && !text ? { text: subject } : {}),
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error?.message || data.name)) ||
      JSON.stringify(data) ||
      `Resend HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function createSmtpTransport() {
  const canonicalHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || 'true') !== 'false';

  const { address: ipv4 } = await dns.lookup(canonicalHost, { family: 4 });

  return nodemailer.createTransport({
    host: ipv4,
    port,
    secure,
    auth: {
      user: process.env.MAIL_HOST,
      pass: process.env.MAIL_PASSWORD,
    },
    connectionTimeout: 25_000,
    greetingTimeout: 15_000,
    socketTimeout: 45_000,
    tls: {
      rejectUnauthorized: false,
      servername: canonicalHost,
    },
  });
}

async function sendViaSmtp({ to, subject, html, text }) {
  if (!process.env.MAIL_HOST || !process.env.MAIL_PASSWORD) {
    throw new Error('MAIL_HOST and MAIL_PASSWORD required for SMTP (local dev).');
  }

  const transport = await createSmtpTransport();
  try {
    return await transport.sendMail({
      from: {
        name: 'Four Score',
        address: process.env.MAIL_HOST,
      },
      to,
      subject,
      html: html || text,
    });
  } finally {
    transport.close();
  }
}

const sendMail = async (opts) => {
  try {
    if (isRenderDeploy) {
      if (!process.env.RESEND_API_KEY) {
        const errMsg =
          '[Email] This app runs on Render: outbound SMTP is blocked. ' +
          'Add RESEND_API_KEY and MAIL_FROM in Render Environment (https://resend.com).';
        console.error(errMsg);
        throw new Error(errMsg);
      }
      return await sendViaResend(opts);
    }

    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(opts);
    }

    return await sendViaSmtp(opts);
  } catch (error) {
    console.log('Error! cannot send Email', error);
    throw error;
  }
};

module.exports = {
  sendMail,
};
