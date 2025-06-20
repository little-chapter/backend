const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Users");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/secret");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendVerificationNewEmail,
} = require("../utils/mailer");
const { generateVerificationCode } = require("../utils/codeGenerator");
const { verifyToken } = require("../middlewares/auth");
const { isValidEmail, isNotValidString } = require("../utils/validUtils");
const { google } = require("googleapis");

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

    // 生成驗證碼並設定過期時間（30分鐘後）
    const verificationCode = generateVerificationCode();
    const codeExpiryTime = new Date();
    codeExpiryTime.setMinutes(codeExpiryTime.getMinutes() + 30);

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立新用戶
    const newUser = userRepository.create({
      email,
      password: hashedPassword,
      role: "customer",
      is_active: false,
      is_admin: false,
      code: verificationCode,
      code_time: codeExpiryTime,
    });

    await userRepository.save(newUser);

    // 發送驗證郵件
    const emailSent = await sendVerificationEmail(email, verificationCode);

    // 回傳成功訊息
    res.status(201).json({
      status: true,
      message: "註冊成功，已發送驗證信至信箱",
      data: emailSent
        ? { email }
        : { email, message: "驗證郵件發送失敗，請稍後使用重新發送驗證信功能" },
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
    const user = await userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "password",
        "role",
        "is_active",
        "is_admin",
        "name",
        "avatar",
      ],
    });
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

    // 生成 JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_DAY || "30d" }
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
          avatar: user.avatar || "",
        },
        token: token,
        expiresIn: 2592000,
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

// 用戶驗證電子郵件
router.get("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.query;

    if (!email || !code) {
      return res.status(400).json({
        status: false,
        message: "缺少驗證資訊",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "找不到此使用者",
      });
    }

    if (user.is_active) {
      return res.status(200).json({
        status: true,
        message: "此帳號已完成驗證",
      });
    }

    if (!user.code || user.code !== code) {
      return res.status(400).json({
        status: false,
        message: "驗證碼無效",
      });
    }

    // 檢查驗證碼是否過期
    const now = new Date();
    if (user.code_time && new Date(user.code_time) < now) {
      return res.status(400).json({
        status: false,
        message: "驗證碼已過期，請重新申請",
      });
    }

    // 更新使用者狀態為已驗證
    user.is_active = true;
    user.code = null;
    user.code_time = null;
    await userRepository.save(user);

    return res.status(200).json({
      status: true,
      message: "電子郵件驗證成功",
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 重新發送驗證郵件
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: false,
        message: "請提供電子郵件地址",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "找不到此使用者",
      });
    }

    if (user.is_active) {
      return res.status(200).json({
        status: true,
        message: "此帳號已完成驗證",
      });
    }

    // 生成新的驗證碼並設定過期時間（30分鐘後）
    const verificationCode = generateVerificationCode();
    const codeExpiryTime = new Date();
    codeExpiryTime.setMinutes(codeExpiryTime.getMinutes() + 30);

    // 更新使用者的驗證碼
    user.code = verificationCode;
    user.code_time = codeExpiryTime;
    await userRepository.save(user);

    // 發送驗證郵件
    const emailSent = await sendVerificationEmail(email, verificationCode);

    return res.status(200).json({
      status: true,
      message: emailSent
        ? "驗證郵件已重新發送"
        : "驗證郵件發送失敗，請稍後再試",
    });
  } catch (error) {
    console.error("Error resending verification email:", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 取得使用者個人資料
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "找不到該用戶",
      });
    }

    // 格式化出生日期為 YYYY-MM-DD 或返回空字串
    const birthDate = user.birth_date
      ? new Date(user.birth_date).toISOString().split("T")[0]
      : "";

    return res.status(200).json({
      status: true,
      data: {
        user: {
          id: user.id,
          name: user.name || "",
          gender: user.gender || "",
          email: user.email,
          phone: user.phone || "",
          birthDate: birthDate,
          address: user.address || "",
          avatar: user.avatar || "",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器發生錯誤，請稍後再試",
    });
  }
});

// 更新使用者個人資料
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, gender, phone, birthDate, address } = req.body;

    // 驗證必填欄位
    if (!name) {
      return res.status(400).json({
        status: false,
        message: "必要欄位未填寫",
      });
    }

    // 驗證名稱格式
    if (typeof name !== "string" || name.trim() === "" || name.length > 50) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    // 驗證性別格式
    if (
      gender !== undefined &&
      gender !== "" &&
      !["male", "female", "other"].includes(gender)
    ) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    // 驗證手機格式 (台灣手機格式)
    const phoneRegex = /^09\d{8}$/;
    if (phone !== undefined && phone !== "" && !phoneRegex.test(phone)) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    // 驗證出生日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
      birthDate !== undefined &&
      birthDate !== "" &&
      !dateRegex.test(birthDate)
    ) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    // 驗證出生日期是否為未來日期或當天
    if (birthDate !== undefined && birthDate !== "") {
      const inputDate = new Date(birthDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 設定為當天的00:00:00

      // 檢查日期是否為未來或當天
      if (inputDate >= today) {
        return res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
      }
    }

    // 驗證地址格式
    if (
      address !== undefined &&
      (typeof address !== "string" || address.length > 255)
    ) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "找不到該用戶",
      });
    }

    // 更新使用者資料
    user.name = name;

    // 檢查欄位是否存在於請求中
    if (gender !== undefined) user.gender = gender;
    if (phone !== undefined) user.phone = phone;
    if (birthDate !== undefined) {
      user.birth_date = birthDate ? new Date(birthDate) : null;
    }
    if (address !== undefined) user.address = address;

    await userRepository.save(user);

    // 回傳更新後的資料
    return res.status(200).json({
      status: true,
      message: "個人資料更新成功",
      data: {
        name: user.name,
        gender: user.gender || "",
        phone: user.phone || "",
        birthDate: user.birth_date
          ? new Date(user.birth_date).toISOString().split("T")[0]
          : "",
        address: user.address || "",
        avatar: user.avatar || "",
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 請求重設密碼
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 驗證電子郵件格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
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

    // 生成重設密碼的驗證碼並設定過期時間（30分鐘後）
    const verificationCode = generateVerificationCode();
    const codeExpiryTime = new Date();
    codeExpiryTime.setMinutes(codeExpiryTime.getMinutes() + 30);

    // 更新使用者的驗證碼
    user.code = verificationCode;
    user.code_time = codeExpiryTime;
    await userRepository.save(user);

    // 發送重設密碼的驗證郵件
    const emailSent = await sendPasswordResetEmail(email, verificationCode);

    // 回傳成功訊息
    return res.status(200).json({
      status: true,
      message: "已發送驗證信至信箱",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 驗證碼驗證
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    // 驗證電子郵件格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "此 Email 尚未註冊",
      });
    }

    // 驗證代碼格式
    if (!code || typeof code !== "string" || code.length !== 6) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    if (!user.code || user.code !== code) {
      return res.status(401).json({
        status: false,
        message: "驗證碼錯誤",
      });
    }

    // 檢查驗證碼是否過期
    const now = new Date();
    if (user.code_time && new Date(user.code_time) < now) {
      return res.status(401).json({
        status: false,
        message: "驗證碼過期，請重新申請",
      });
    }

    // 回傳驗證成功訊息
    return res.status(200).json({
      status: true,
      data: {
        email: user.email,
        code: user.code,
      },
    });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 設定新密碼
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    // 驗證電子郵件格式
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email) || email.length > 255) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "此 Email 尚未註冊",
      });
    }

    // 驗證代碼格式
    if (!code || typeof code !== "string" || code.length !== 6) {
      return res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
    }

    if (!user.code || user.code !== code) {
      return res.status(401).json({
        status: false,
        message: "驗證碼錯誤",
      });
    }

    // 檢查驗證碼是否過期
    const now = new Date();
    if (user.code_time && new Date(user.code_time) < now) {
      return res.status(401).json({
        status: false,
        message: "驗證碼過期，請重新申請",
      });
    }

    // 驗證密碼格式
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      return res.status(400).json({
        status: false,
        message: "密碼格式錯誤，請輸入8-16個英數字元，區分英文大小寫",
      });
    }

    // 加密新密碼
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新使用者密碼，清除驗證碼
    user.password = hashedPassword;
    user.code = null;
    user.code_time = null;
    await userRepository.save(user);

    // 回傳成功訊息
    return res.status(200).json({
      status: true,
      message: "密碼已成功重設",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// 更新使用者密碼
router.put("/password", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // 驗證密碼格式
    const passwordRegex = /^[a-zA-Z0-9]{8,16}$/;
    if (
      !currentPassword ||
      !passwordRegex.test(currentPassword) ||
      !newPassword ||
      !passwordRegex.test(newPassword)
    ) {
      return res.status(400).json({
        status: false,
        message: "當前密碼或新密碼不符合規則",
      });
    }

    const userRepository = dataSource.getRepository("User");
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ["id", "password"],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "找不到該用戶",
      });
    }

    // 驗證當前密碼
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        status: false,
        message: "當前密碼輸入錯誤",
      });
    }

    // 加密新密碼
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密碼
    user.password = hashedPassword;
    await userRepository.save(user);

    return res.status(200).json({
      status: true,
      message: "密碼更新成功",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

// /請求更新 Email
router.post("/email-change", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newEmail = null } = req.body;

    // 驗證新 email 為有效資料
    if (!isValidEmail(newEmail)) {
      res.status(400).json({
        status: false,
        message: "請輸入有效的 Email",
      });
      return;
    }

    // 驗證有這個用戶
    const userRepo = dataSource.getRepository("User");
    const user = await userRepo.findOne({
      where: { id: userId },
    });
    if (!user) {
      res.status(404).json({
        status: false,
        message: "找不到該用戶",
      });
      return;
    }

    // 驗證新 Email 沒被註冊
    const existingEmail = await userRepo.findOne({
      where: { email: newEmail },
    });
    if (existingEmail) {
      res.status(409).json({
        status: false,
        message: "此 Email 已被註冊",
      });
      return;
    }

    // 生成驗證碼並設定過期時間（30分鐘後）
    const verificationCode = generateVerificationCode();
    // const codeExpiryTime = new Date();
    // codeExpiryTime.setMinutes(codeExpiryTime.getMinutes() + 30);
    const EXPIRY_MINUTES = 30;
    const codeExpiryTime = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    // 將新 Email、驗證碼、驗證碼過期時間 寫入資料表
    user.new_email = newEmail;
    user.new_email_code = verificationCode;
    user.new_email_code_time = codeExpiryTime;
    await userRepo.save(user);

    // 寄發驗證信
    const emailSent = await sendVerificationNewEmail(
      newEmail,
      verificationCode
    );

    res.status(200).json({
      status: true,
      message: emailSent
        ? "已發送驗證信至信箱"
        : "驗證郵件發送失敗，請稍後使用重新發送驗證信功能",
    });
  } catch (error) {
    logger.error("更新 Email 失敗: ", error);
    next(error);
  }
});

// 請求驗證新 Email
router.post("/email-change/verify", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newEmail = null, newEmailCode = null } = req.body;

    // 驗證新 email 為有效資料
    if (!isValidEmail(newEmail)) {
      res.status(400).json({
        status: false,
        message: "請輸入有效的 Email",
      });
      return;
    }

    // 驗證有這個用戶 與 驗證碼有效
    const userRepo = dataSource.getRepository("User");
    const user = await userRepo.findOne({
      select: [
        "id",
        "email",
        "new_email",
        "new_email_code",
        "new_email_code_time",
      ],
      where: { id: userId },
    });
    if (!user) {
      res.status(404).json({
        status: false,
        message: "找不到該用戶",
      });
      return;
    }
    if (newEmail !== user.new_email) {
      res.status(400).json({
        status: false,
        message: "Email 與 驗證紀錄不符",
      });
      return;
    }
    if (newEmailCode !== user.new_email_code) {
      res.status(400).json({
        status: false,
        message: "請輸入有效的驗證碼",
      });
      return;
    }
    const now = new Date();
    if (!user.new_email_code_time || now > user.new_email_code_time) {
      res.status(400).json({
        status: false,
        message: "驗證碼過期，請重新申請",
      });
      return;
    }

    // 更新 Email
    user.email = newEmail;
    user.new_email = null;
    user.new_email_code = null;
    user.new_email_code_time = null;
    await userRepo.save(user);

    res.status(200).json({
      status: true,
      message: "Email 已更新，請重新登入",
    });
  } catch (error) {
    logger.error("驗證新 Email 失敗: ", error);
    next(error);
  }
});

// Google 第三方登入
router.post("/google-sign-in", async (req, res) => {
  try {
    const { idToken } = req.body;

    // 驗證必要參數
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({
        status: false,
        message: "缺少必要參數",
      });
    }

    // 創建 OAuth2 客戶端並驗證 ID Token
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_AUTH_CLIENTID,
      process.env.GOOGLE_AUTH_CLIENT_SECRET
    );

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_AUTH_CLIENTID,
      });
      payload = ticket.getPayload();
    } catch (error) {
      console.error("Google ID Token verification failed:", error);
      return res.status(400).json({
        status: false,
        message: "Google ID Token 無效或已過期",
      });
    }

    // 從 Google 取得用戶資訊
    const email = payload.email;
    const name = payload.name;
    const avatar = payload.picture;

    if (!email) {
      return res.status(400).json({
        status: false,
        message: "無法從 Google 獲取用戶資訊",
      });
    }

    const userRepository = dataSource.getRepository("User");

    // 檢查用戶是否已存在
    let user = await userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "name",
        "role",
        "is_active",
        "is_admin",
        "avatar",
      ],
    });

    if (!user) {
      // 用戶不存在，創建新用戶
      const randomPassword = Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = userRepository.create({
        email,
        name: name || "",
        avatar: avatar || "",
        password: hashedPassword, // Google 用戶使用隨機密碼
        role: "customer",
        is_active: true, // Google 用戶預設為已驗證
        is_admin: false,
      });

      user = await userRepository.save(newUser);
    } else {
      // 檢查帳戶是否被停用
      if (!user.is_active) {
        return res.status(403).json({
          status: false,
          message: "該 Google 帳號已被停用",
        });
      }

      // 更新用戶頭像（如果 Google 頭像有更新）
      if (avatar && user.avatar !== avatar) {
        user.avatar = avatar;
        await userRepository.save(user);
      }
    }

    // 生成 JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_DAY || "30d" }
    );

    // 統一回傳登入成功訊息與使用者資訊
    res.status(200).json({
      status: true,
      message: "登入成功",
      data: {
        user: {
          id: user.id,
          name: user.name || "",
          email: user.email,
          role: user.role,
          avatar: user.avatar || "",
        },
        token: token,
        expiresIn: 2592000,
      },
    });
  } catch (error) {
    console.error("Error during Google sign-in:", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

module.exports = router;
