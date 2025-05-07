const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const logger = require("./logger")("Mailer");

/**
 * 創建 OAuth2 客戶端
 * @returns {Promise<{accessToken: string}>} 包含訪問令牌的對象
 */
const getAccessToken = async () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_AUTH_CLIENTID,
    process.env.GOOGLE_AUTH_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
  });

  const { token } = await oauth2Client.getAccessToken();
  return { accessToken: token };
};

/**
 * 創建 nodemailer 傳輸器
 * @returns {Promise<nodemailer.Transporter>} Nodemailer 傳輸器
 */
const createTransporter = async () => {
  const { accessToken } = await getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.GOOGLE_AUTH_CLIENTID,
      clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_AUTH_REFRESH_TOKEN,
      accessToken,
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
    const transporter = await createTransporter();

    const mailOptions = {
      from: {
        name: "Little Chapter",
        address: process.env.EMAIL_USER,
      },
      to,
      subject: "Little Chapter - 請驗證您的電子郵件",
      html: `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>電子郵件驗證</title>
        </head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border: 1px solid #e9e9e9; border-radius: 5px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #4a4a4a; margin-top: 0;">驗證您的電子郵件地址</h2>
            </div>
            <p>親愛的用戶，您好：</p>
            <p>感謝您註冊 Little Chapter 繪本平台！為確保帳戶安全，請使用以下驗證碼完成您的電子郵件驗證：</p>
            <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 22px; font-family: monospace; letter-spacing: 2px; font-weight: bold;">
              ${code}
            </div>
            <p>或者，您可以直接點擊以下按鈕進行驗證：</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${
                process.env.WEBSITE_URL
              }/api/users/verify-email?email=${encodeURIComponent(
        to
      )}&code=${code}" 
                 style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500;">
                 驗證電子郵件
              </a>
            </div>
            <p>此驗證碼將在 30 分鐘內有效。</p>
            <p>如果您並未註冊 Little Chapter 帳戶，請忽略此郵件。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="font-size: 12px; color: #777; text-align: center;">
              此為系統自動發送的郵件，請勿直接回覆。<br>
              © ${new Date().getFullYear()} Little Chapter 繪本平台. 保留所有權利。
            </p>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error(`發送驗證郵件錯誤: ${error.message}`);
    return false;
  }
};

/**
 * 發送重設密碼驗證信
 * @param {string} to 收件人
 * @param {string} code 驗證碼
 * @returns {Promise<boolean>} 是否發送成功
 */
const sendPasswordResetEmail = async (to, code) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: {
        name: "Little Chapter",
        address: process.env.EMAIL_USER,
      },
      to,
      subject: "Little Chapter - 重設您的密碼",
      html: `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>重設密碼</title>
        </head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border: 1px solid #e9e9e9; border-radius: 5px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #4a4a4a; margin-top: 0;">重設您的密碼</h2>
            </div>
            <p>親愛的用戶，您好：</p>
            <p>我們收到了您重設密碼的請求。請使用以下驗證碼完成密碼重設：</p>
            <div style="background-color: #f6f6f6; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; font-size: 22px; font-family: monospace; letter-spacing: 2px; font-weight: bold;">
              ${code}
            </div>
            <p>請回到 Little Chapter 網站的重設密碼頁面，輸入此驗證碼以完成重設密碼程序。</p>
            <p>此驗證碼將在 30 分鐘內有效。</p>
            <p>如果您沒有要求重設密碼，請忽略此郵件。您的帳戶安全沒有受到影響。</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="font-size: 12px; color: #777; text-align: center;">
              此為系統自動發送的郵件，請勿直接回覆。<br>
              © ${new Date().getFullYear()} Little Chapter 繪本平台. 保留所有權利。
            </p>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error(`發送重設密碼郵件錯誤: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
