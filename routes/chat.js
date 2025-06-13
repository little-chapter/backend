const express = require("express");
const OpenAI = require("openai");
const rateLimiter = require("../middlewares/rateLimiter");
const logger = require("../utils/logger")("Chat");

const router = express.Router();

// 初始化OpenAI客戶端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 使用環境變數設定模型名稱
const MODEL_NAME = process.env.OPENAI_FINE_TUNED_MODEL || "gpt-4o-mini";

// 精簡的系統提示詞 - 專業知識已在fine-tuning中訓練
const SYSTEM_PROMPT = `你是一個專業客服，請以親切的態度回答此繪本電商相關問題。`;

// AI客服對話
router.post("/", rateLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    // 輸入格式驗證
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        status: false,
        message: "訊息內容不可為空",
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: "訊息內容不可為空",
      });
    }

    if (message.length > 100) {
      return res.status(400).json({
        status: false,
        message: "訊息內容超過字數限制",
      });
    }

    // 呼叫OpenAI API (使用fine-tuned模型)
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: message.trim(),
        },
      ],
      max_tokens: 300, // 降低token數量
      temperature: 0.7, // 確保一致回應
      top_p: 0.4,
    });

    const aiResponse = completion.choices[0].message.content;

    logger.info(
      `AI客服回應 (模型: ${MODEL_NAME}): ${message} -> ${aiResponse.substring(
        0,
        50
      )}...`
    );

    return res.status(200).json({
      status: true,
      message: aiResponse,
    });
  } catch (error) {
    logger.error("OpenAI API錯誤:", error);

    // 特別處理fine-tuned模型的錯誤
    if (error.code === "model_not_found") {
      logger.error(`Fine-tuned模型未找到: ${MODEL_NAME}`);
      return res.status(500).json({
        status: false,
        message: "AI客服模型配置錯誤，請聯繫技術支援",
      });
    }

    // 如果是OpenAI相關錯誤，回傳服務暫時不可用
    if (error.code || error.type) {
      return res.status(500).json({
        status: false,
        message: "AI客服暫時不可用，請稍後再試",
      });
    }

    return res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});

module.exports = router;
