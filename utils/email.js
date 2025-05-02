// utils/email.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const sendEmail = async (options) => {
  // 1. Tạo transporter (giữ nguyên)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // 2. Định nghĩa các tùy chọn email - SỬA Ở ĐÂY
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Biolink App"}" <${
      process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME
    }>`,
    to: options.email,
    subject: options.subject,
    text: options.text, // <-- Giữ lại nội dung text làm fallback
    html: options.html, // <-- THÊM DÒNG NÀY để nhận nội dung HTML
  };

  // 3. Gửi email (giữ nguyên)
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Gửi email thất bại.");
  }
};

module.exports = sendEmail;
