const nodemailer = require('nodemailer');
require('dotenv').config();

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
  family: 4,
  auth: {
    user: process.env.MAIL_HOST,
    pass: process.env.MAIL_PASSWORD,
  },
  connectionTimeout: 25_000,
  greetingTimeout: 15_000,
  socketTimeout: 45_000,
  tls: {
    rejectUnauthorized: false,
  },
});

const sendMail = async ({ to, subject, html, text }) => {
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
  }
};

module.exports = {
  sendMail,
};
