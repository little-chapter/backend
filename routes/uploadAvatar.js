const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Storage } = require('@google-cloud/storage');
const { gcp } = require('../config/secret');
const { verifyToken } = require("../middlewares/auth");
const { dataSource } = require("../db/data-source");

// 檔案過濾器 - 只允許圖片格式
const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('只允許上傳 JPEG 或 PNG 格式的圖片');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Google Cloud Storage 客戶端配置
const storage = new Storage({
  projectId: gcp.projectId,
  keyFilename: gcp.serviceAccountKeyPath,
});
const bucket = storage.bucket(gcp.bucketName);

// 本地臨時儲存配置 - 用於即時檔案檢查
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 使用臨時目錄
    const tempDir = path.join(__dirname, '../temp/avatars');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一檔名，包含使用者ID和時間戳
    const timestamp = Date.now();
    const userId = req.user?.id || 'anonymous';
    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}${fileExtension}`;
    cb(null, filename);
  }
});

// 創建 multer 實例 - 先存到本地進行即時檔案檢查
const upload = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB 限制 - 即時檢查檔案大小
    files: 1 // 只允許一個檔案 - 即時檢查檔案數量
  }
});

// 上傳檔案到 GCP 的函數
const uploadToGCP = async (localFilePath, fileName, mimetype) => {
  try {
    const gcpFileName = `avatars/${fileName}`;
    
    // 上傳檔案到 GCP
    await bucket.upload(localFilePath, {
      destination: gcpFileName,
      metadata: {
        contentType: mimetype,
      },
      public: true, // 設為公開讀取
    });
    
    // 生成公開 URL
    const publicUrl = gcp.storageBaseUrl 
      ? `${gcp.storageBaseUrl}${gcpFileName}`
      : `https://storage.googleapis.com/${gcp.bucketName}/${gcpFileName}`;
    
    return { success: true, publicUrl, gcpFileName };
  } catch (error) {
    console.error('Upload to GCP error:', error);
    return { success: false, error: error.message };
  }
};

// 刪除本地臨時檔案的函數
const deleteLocalFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log('Local temp file deleted:', filePath);
  } catch (error) {
    console.error('Delete local file error:', error);
  }
};

/**
 * POST /api/upload/avatar
 * 上傳使用者大頭照
 * 
 * 要求：
 * - 需要登入（JWT Token）
 * - Content-Type: multipart/form-data
 * - 檔案欄位名稱: avatar
 * - 檔案大小: 最大 1MB
 * - 檔案格式: JPEG 或 PNG
 * - 只能上傳一張照片
 */
router.post('/', verifyToken, (req, res, next) => {
  // 包裝 multer middleware 以正確處理錯誤
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      // 立即處理 multer 錯誤
      console.error('Multer error:', err);
      
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({
              status: false,
              message: '檔案大小超過限制，最大允許 1MB'
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({
              status: false,
              message: '未預期的檔案欄位，請使用 avatar 欄位名稱'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              status: false,
              message: '只能上傳一個檔案'
            });
          default:
            return res.status(400).json({
              status: false,
              message: '檔案上傳錯誤'
            });
        }
      } else if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          status: false,
          message: err.message
        });
      } else {
        return res.status(500).json({
          status: false,
          message: '檔案上傳失敗，請稍後再試'
        });
      }
    }
    
    // 沒有錯誤，繼續到下一個處理器
    next();
  });
}, async (req, res) => {
  let localFilePath = null;
  
  try {
    // 檢查是否有檔案上傳
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: '請選擇要上傳的照片'
      });
    }

    // 取得本地檔案資訊
    localFilePath = req.file.path;
    const fileName = req.file.filename;
    const mimetype = req.file.mimetype;
    
    console.log('File saved locally:', {
      localPath: localFilePath,
      fileName: fileName,
      size: req.file.size,
      mimetype: mimetype
    });

    // 上傳檔案到 GCP
    const gcpResult = await uploadToGCP(localFilePath, fileName, mimetype);
    
    if (!gcpResult.success) {
      // GCP 上傳失敗，刪除本地檔案
      await deleteLocalFile(localFilePath);
      return res.status(500).json({
        status: false,
        message: `雲端上傳失敗: ${gcpResult.error}`
      });
    }

    // 將檔案 URL 儲存到資料庫
    const userId = req.user.id;
    const userRepository = dataSource.getRepository("User");
    
    // 檢查使用者是否存在
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      // 使用者不存在，刪除本地檔案
      await deleteLocalFile(localFilePath);
      return res.status(404).json({
        status: false,
        message: '找不到該使用者'
      });
    }
    
    // 更新使用者的頭像 URL
    await userRepository.update(userId, { avatar: gcpResult.publicUrl });
    
    // 成功後刪除本地臨時檔案
    await deleteLocalFile(localFilePath);
    
    res.status(200).json({
      status: true,
      message: '大頭照上傳成功',
      data: {
        avatar: gcpResult.publicUrl
      }
    });
    
  } catch (error) {
    console.error('Avatar upload processing error:', error);
    
    // 發生錯誤時清理本地檔案
    if (localFilePath) {
      await deleteLocalFile(localFilePath);
    }
    
    // 只處理非 multer 錯誤（multer 錯誤已在 middleware 中處理）
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試"
    });
  }
});


module.exports = router;
