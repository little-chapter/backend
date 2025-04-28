/**
 * 生成指定長度的隨機驗證碼
 * @param {number} length 驗證碼長度，預設為 6
 * @returns {string} 隨機驗證碼
 */
const generateVerificationCode = (length = 6) => {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
};

module.exports = {
  generateVerificationCode,
};
