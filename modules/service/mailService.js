const nodemailer = require('nodemailer');
require('dotenv').config();

const transport = nodemailer.createTransport({
  service: 'gmail',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_HOST,
    pass: process.env.MAIL_PASSWORD,
  },
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
