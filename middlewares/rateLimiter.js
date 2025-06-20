const NodeCache = require("node-cache");

// 創建兩個快取實例：分鐘級別和日級別
const minuteCache = new NodeCache({ stdTTL: 60 });
const dayCache = new NodeCache({ stdTTL: 86400 });

const rateLimiter = (req, res, next) => {
  const clientIP =
    req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];

  // 建立快取鍵
  const minuteKey = `minute:${clientIP}`;
  const dayKey = `day:${clientIP}`;

  // 檢查分鐘級別限制
  const minuteCount = minuteCache.get(minuteKey) || 0;
  if (minuteCount >= 6) {
    return res.status(429).json({
      status: false,
      message: "請求次數過多，請稍後再試",
    });
  }

  // 檢查日級別限制
  const dayCount = dayCache.get(dayKey) || 0;
  if (dayCount >= 30) {
    return res.status(429).json({
      status: false,
      message: "請求次數過多，請稍後再試",
    });
  }

  // 增加計數
  minuteCache.set(minuteKey, minuteCount + 1);
  dayCache.set(dayKey, dayCount + 1);

  next();
};

module.exports = rateLimiter;
