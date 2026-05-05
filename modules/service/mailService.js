const dns = require('dns').promises;
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Render (and similar hosts) often cannot reach Gmail over IPv6 (ENETUNREACH).
 * Nodemailer's `family: 4` / dns.setDefaultResultOrder are not always respected.
 * We resolve A record explicitly and connect by IPv4, with TLS SNI set to the real hostname.
 */
async function createTransport() {
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

const sendMail = async ({ to, subject, html, text }) => {
  const transport = await createTransport();
  try {
    const mailOptions = {
      from: {
        name: 'Four Score',
        address: process.env.MAIL_HOST,
      },
      to,
      subject,
      html: html || text,
    };

    const info = await transport.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.log('Error! cannot send Email', error);
    throw error;
  } finally {
    transport.close();
  }
};

module.exports = {
  sendMail,
};
