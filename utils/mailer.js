const nodemailer = require("nodemailer");
const logger = require("./logger")("Mailer");

/**
 * 創建郵件傳輸器
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * 發送電子郵件驗證信
 * @param {string} to 收件人
 * @param {string} code 驗證碼
 * @returns {Promise<boolean>} 是否發送成功
 */
const sendVerificationEmail = async (to, code) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Little Chapter" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Little Chapter - 請驗證您的電子郵件",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">驗證您的電子郵件地址</h2>
          <p>感謝您註冊 Little Chapter！請使用以下驗證碼完成您的電子郵件驗證：</p>
          <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h3 style="font-family: monospace; font-size: 24px; margin: 0; color: #333;">${code}</h3>
          </div>
          <p>或者，您可以直接點擊以下連結進行驗證：</p>
          <p><a href="${
            process.env.WEBSITE_URL
          }/api/users/verify-email?email=${encodeURIComponent(
        to
      )}&code=${code}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">驗證電子郵件</a></p>
          <p>此驗證碼將在 30 分鐘內有效。</p>
          <p>如果您並未註冊 Little Chapter 帳戶，請忽略此郵件。</p>
          <p style="margin-top: 30px; color: #777; font-size: 12px;">© ${new Date().getFullYear()} Little Chapter. 保留所有權利。</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`驗證郵件已發送至 ${to}`);
    return true;
  } catch (error) {
    logger.error(`發送驗證郵件錯誤: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
};
