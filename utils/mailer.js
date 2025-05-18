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

/**
 * 發送訂單成立信
 * @param {string} to 收件人
 * @param {object} order 訂單資訊
 * @param {string} itemStr 訂單項目
 * @returns {Promise<boolean>} 是否發送成功
 */
const sendOrderConfirmationEmail = async (to, order, itemsStr) => {
  try {
    const transporter = await createTransporter();
    const mailOptions = {
      from: {
        name: "Little Chapter",
        address: process.env.EMAIL_USER,
      },
      to,
      subject: `Little Chapter - 您的訂單 ${order.orderNumber} 已成立`,
      html: `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>您的訂單 ${order.orderNumber} 已成立</title>
            <style>
              p{
                margin-top: 0;
              }
              hr{
                border: none;
                border-top: 1px solid #eee;
                margin: 25px 0;
              }
              .title{
                text-align: center;
                color: #e8652b;
                margin: 0;
                padding-top: 15px;
              }
              .column{
                display: flex;
                justify-content: space-between;
              }
            </style>
        </head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border: 1px solid #e9e9e9; border-radius: 5px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="https://a-little-chapter-frontend.vercel.app/" target="_blank">
                <img src="https://firebasestorage.googleapis.com/v0/b/little-chapter.firebasestorage.app/o/logo%2Flogo.png?alt=media&token=21043e7f-9478-49b2-a4c9-d11a6dd2bce2" alt="Little-Chapter-Logo" style="width: 300px; text-align: center;">
              </a>
              <h2 style="color: #e8652b; margin-top: 0;">您的訂單 ${order.orderNumber} 已成立！</h2>
            </div>
            <div class="column">
              <p>訂單狀態：</p>
              <p>${order.orderStaus}</p>
            </div>
            <div class="column">
              <p>付款狀態：</p>
              <p>${order.paymentStaus}</p>
            </div>
            <div class="column">
              <p>送貨狀態：</p>
              <p>${order.shippingStaus}</p>
            </div>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${
                process.env.WEBSITE_URL
              }/api/orders/${order.orderNumber}" 
              style="display: inline-block; background-color: #e8652b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 1000px; font-weight: 500;">
              查看訂單詳細
              </a>
            </div>
            <hr>
            <h3 class="title">訂單資訊</h3>
            <div class="column">
              <p>成立時間：</p>
              <p>${order.createdAt}</p>
            </div>
            <div class="column">
              <p>訂單編號：</p>
              <p>${order.orderNumber}</p>
            </div>
            <div class="column">
              <p>訂購人：</p>
              <p>${order.userName}</p>
            </div>
            <h3 class="title">付款資訊</h3>
            <div class="column">
              <p>交易時間：</p>
              <p>${order.payTime}</p>
            </div>
            <div class="column">
              <p>交易金額：</p>
              <p>NT$${order.amount}</p>
            </div>
            <div class="column">
              <p>付款方式：</p>
              <p>${order.paymentMethod}</p>
            </div>
            <div class="column">
              <p>發票類型：</p>
              <p>${order.invoiceType}</p>
            </div>
            <h3 class="title">送貨資訊</h3>
            <div class="column">
              <p>送貨方式：</p>
              <p>${order.shippingMethod}</p>
            </div>
            <div class="column">
              <p>收件人：</p>
              <p>${order.recipientName}</p>
            </div>
            <div class="column">
              <p>收件人信箱：</p>
              <p>${order.recipientEmail}</p>
            </div>
            <div class="column">
              <p>收件人電話：</p>
              <p>${order.recipientPhone}</p>
            </div>
            <div class="column">
              <p>收件地址：</p>
              <p>${order.shippingAddress}</p>
            </div>
            <h3 class="title">訂單備註</h3>
            <p style="text-align: center;">${order.note}</p>
            <h3 class="title">訂購商品</h3>
            <ul style="list-style-type: none; padding: 0;">
              ${itemsStr}
            </ul>
            <hr>
            <div class="column">
              <p>小計</p>
              <p>NT$${order.totalAmount}</p>
            </div>
            <div class="column" style="color: red;">
              <p>折扣</p>
              <p>- NT$${order.discountAmount}</p>
            </div>
            <div class="column">
              <p>運費</p>
              <p>NT$${order.shippingFee}</p>
            </div>
            <div class="column">
              <p>合計</p>
              <p>NT$${order.finalAmount}</p>
            </div>
            <hr>
            <p style="font-size: 12px; color: #777; text-align: center;">
              此為系統自動發送的郵件，請勿直接回覆。<br>
              © ${new Date().getFullYear()} Little Chapter 繪本平台. 保留所有權利。
            </p>
          </div>
        </body>
        </html>`,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error(`發送訂單成立郵件錯誤: ${error.message}`);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};
