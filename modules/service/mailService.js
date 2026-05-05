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
require("dotenv").config();

/**
 * 🔧 TRANSPORT CONFIG
 */
const transport = nodemailer.createTransport({
  service: "gmail",

  // 🔴 CHANGE #1
  // Gmail ke liye 465 + secure true correct hota hai
  port: 465,
  secure: true,

  auth: {
    user: process.env.MAIL_HOST,     // example@gmail.com
    pass: process.env.MAIL_PASSWORD, // Gmail App Password
  },

  // 🔴 CHANGE #2
  // Self-signed certificate error fix
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * 📧 SEND EMAIL FUNCTION
 */
const sendEmail = async (sub, to, html) => {
  try {
    const mailOptions = {
      from: {
        name: "Four Score",
        address: process.env.MAIL_HOST,
      },
      to,
      subject: sub,
      html,
    };

    // 🔴 CHANGE #3
    // await lagaya – pehle promise return ho raha tha
    const info = await transport.sendMail(mailOptions);

    return info; // same return type
  } catch (error) {
    console.log("❌ Error! cannot send Email", error);

    // 🔴 CHANGE #4
    // consistent false return on failure
    return false;
  }
};

module.exports = sendEmail;
