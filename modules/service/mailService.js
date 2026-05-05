const sgMail = require("@sendgrid/mail");
require("dotenv").config();

const sendgridApiKey = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS || "";
const mailFrom = process.env.MAIL_FROM || "";

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

/**
 * 📧 SEND EMAIL FUNCTION
 */
const sendEmail = async (sub, to, html) => {
  try {
    if (!sendgridApiKey) {
      console.log("❌ Error! cannot send Email: SENDGRID_API_KEY is missing");
      return false;
    }

    if (!mailFrom) {
      console.log("❌ Error! cannot send Email: MAIL_FROM is missing");
      return false;
    }

    const msg = {
      from: {
        name: "Four Score",
        email: mailFrom,
      },
      to,
      subject: sub,
      html,
    };

    const [response] = await sgMail.send(msg);
    return response;
  } catch (error) {
    const details = error?.response?.body || error?.message || error;
    console.log("❌ Error! cannot send Email", details);
    return false;
  }
};

module.exports = sendEmail;
