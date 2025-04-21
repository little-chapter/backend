const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const bcrypt = require("bcrypt");

// 用戶註冊
router.post("/sign-up", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "請提供電子郵件和密碼" });
    }

    const userRepository = dataSource.getRepository("User");

    // 檢查電子郵件是否已註冊
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "該電子郵件已被註冊" });
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立新用戶，只設置必要欄位，其他欄位保持默認值或 null
    const newUser = userRepository.create({
      email,
      password: hashedPassword,
      role: "customer", // 默認角色
      is_active: true, // 預設為活躍
      is_admin: false,
    });

    await userRepository.save(newUser);

    res.status(201).json({ message: "註冊成功" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "註冊失敗" });
  }
});

module.exports = router;
