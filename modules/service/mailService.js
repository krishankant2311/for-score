// const nodemailer = require('nodemailer')
// require('dotenv').config();

// const transport = nodemailer.createTransport({
//     service:"gmail",
//     secure:true,
//     auth:{
//         user:process.env.MAIL_HOST,
//         pass:process.env.MAIL_PASSWORD,
//     }
// });
// const sendEmail = async (sub,to,html)=>{
//     try {
//         const mailOptions = {
//             from:{
//                 name:'Crawfish',
//                 address:process.env.MAIL_HOST
//             },
//             subject:sub,
//             to,
//             html
//         };
//         transport.verify((error, succes) => {
//             if(error)
//                 console.log("error!!!! inside the helper", error)
//             else{
//                 console.log("server is ready to send email", succes)
//             }
//         });
//         const emailSend = transport.sendMail(mailOptions);
//          return emailSend;

//     } catch (error) {
//      console.log('Error! can not send Email',error);
//      return error
        
//     }
// };
// module.exports = sendEmail;


const nodemailer = require("nodemailer");
const dns = require("dns");
require("dotenv").config();

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER || process.env.MAIL_HOST;
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD;
const mailFrom = process.env.MAIL_FROM || process.env.MAIL_HOST || smtpUser;
const tlsRejectUnauthorized =
  String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() === "true";
const smtpHostIpv4 = process.env.SMTP_HOST_IPV4;

const createTransport = (hostForConnection) =>
  nodemailer.createTransport({
    host: hostForConnection,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Prevent hanging forever on restricted egress networks.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 20000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
    // Some hosting/proxy environments present non-standard cert chains.
    tls: {
      rejectUnauthorized: tlsRejectUnauthorized,
      // Keep certificate validation mapped to original SMTP hostname.
      servername: smtpHost,
    },
    // Hard-force IPv4 when Node still tries IPv6 first.
    family: 4,
  });

const resolveSmtpIpv4 = async () => {
  if (smtpHostIpv4) return smtpHostIpv4;

  try {
    const addresses = await dns.promises.resolve4(smtpHost);
    if (Array.isArray(addresses) && addresses.length > 0) {
      return addresses[0];
    }
  } catch (err) {
    console.log("SMTP IPv4 resolve failed, falling back to hostname:", err.message);
  }

  return smtpHost;
};

/**
 * 📧 SEND EMAIL FUNCTION
 */
const sendEmail = async (sub, to, html) => {
  try {
    const smtpConnectionHost = await resolveSmtpIpv4();
    const transport = createTransport(smtpConnectionHost);

    const mailOptions = {
      from: {
        name: "Four Score",
        address: mailFrom,
      },
      to,
      subject: sub,
      html,
    };

    const info = await transport.sendMail(mailOptions);

    return info;
  } catch (error) {
    console.log("❌ Error! cannot send Email", error);
    return false;
  }
};

module.exports = sendEmail;
