const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/secret");

// 用戶註冊
router.post("/sign-up", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 驗證電子郵件格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({
        status: false,
        message: "請輸入有效的 Email",
      });
    }

    // 驗證密碼格式
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!password || !passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message: "密碼格式錯誤，請輸入 8-16 個英數字元，區分英文大小寫",
      });
    }

    const userRepository = dataSource.getRepository("User");

    // 檢查電子郵件是否已註冊
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        status: false,
        message: "此 Email 已被註冊",
      });
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立新用戶
    const newUser = userRepository.create({
      email,
      password: hashedPassword,
      role: "customer",
      is_active: false,
      is_admin: false,
    });

    await userRepository.save(newUser);

    // 回傳成功訊息
    res.status(201).json({
      status: true,
      message: "註冊成功，已發送驗證信至信箱",
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 用戶登入
router.post("/log-in", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 驗證電子郵件格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({
        status: false,
        message: "請輸入有效的 Email",
      });
    }

    // 驗證密碼格式
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!password || !passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message: "密碼格式錯誤，請輸入 8-16 個英數字元，區分英文大小寫",
      });
    }

    const userRepository = dataSource.getRepository("User");

    // 檢查使用者是否存在
    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "此 Email 尚未註冊",
      });
    }

    // 比對密碼
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: false,
        message: "Email 或密碼錯誤",
      });
    }

    // 檢查帳戶是否已驗證
    if (!user.is_active) {
      return res.status(403).json({
        status: false,
        message: "帳戶未驗證，請先驗證 Email",
      });
    }

    // 生成 JWT token，有效期為一天
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      jwtSecret,
      { expiresIn: 86400 } // 24 小時 (24*60*60 秒)
    );

    // 回傳登入成功訊息與使用者資訊
    res.status(200).json({
      status: true,
      message: "登入成功",
      data: {
        user: {
          id: user.id,
          name: user.name || "",
          email: user.email,
          role: user.role,
        },
        token: token,
        expiresIn: 86400,
      },
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

module.exports = router;
