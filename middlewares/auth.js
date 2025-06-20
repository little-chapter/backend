const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/secret");
const { dataSource } = require("../db/data-source");

/**
 * 驗證 JWT 權杖的中間件
 */
const verifyToken = async (req, res, next) => {
  try {
    // 從 Authorization 標頭獲取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: false,
        message: "Token 無效或過期，請重新登入",
      });
    }

    const token = authHeader.split(" ")[1];

    // 驗證 token
    const decoded = jwt.verify(token, jwtSecret);

    // 從資料庫取得使用者資料
    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({
        status: false,
        message: "Token 無效或過期，請重新登入",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: false,
        message: "權限不足，無法存取此資訊",
      });
    }

    // 將使用者資訊添加到請求對象
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_admin: user.is_admin,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: false,
        message: "Token 無效或過期，請重新登入",
      });
    }

    return res.status(401).json({
      status: false,
      message: "Token 無效或過期，請重新登入",
    });
  }
};

/**
 * 驗證使用者是否為管理員的中間件
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      status: false,
      message: "權限不足，無法存取此資訊",
    });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
};
