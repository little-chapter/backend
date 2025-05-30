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
    const tempDir = path.join(__dirname, '../temp/products');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一檔名，包含商品ID和時間戳
    const timestamp = Date.now();
    const productId = req.params.product_id || 'unknown';
    const randomNum = Math.floor(Math.random() * 10000);
    const fileExtension = path.extname(file.originalname);
    const filename = `${productId}_${timestamp}_${randomNum}${fileExtension}`;
    cb(null, filename);
  }
});

// 創建 multer 實例 - 先存到本地進行即時檔案檢查
const upload = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB 限制 - 即時檢查檔案大小
    files: 6 // 最多6個檔案 - 即時檢查檔案數量
  }
});

// 上傳檔案到 GCP 的函數
const uploadToGCP = async (localFilePath, fileName, mimetype, productId) => {
  try {
    const gcpFileName = `products/${productId}/${fileName}`;
    
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
    
    return { status: true, publicUrl };
  } catch (error) {
    console.error('Upload to GCP error:', error);
    return { status: false, error: error.message };
  }
};

// 刪除本地臨時檔案的函數
const deleteLocalFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Delete local file error:', error);
  }
};

// 批量刪除本地臨時檔案的函數
const deleteLocalFiles = async (filePaths) => {
  const deletePromises = filePaths.map(filePath => deleteLocalFile(filePath));
  await Promise.allSettled(deletePromises);
};

/**
 * POST /api/admin/products/:product_id/images
 * 上傳商品圖片
 * 
 * 要求：
 * - 需要登入（JWT Token）
 * - Content-Type: multipart/form-data
 * - 檔案欄位名稱: productImages
 * - 檔案大小: 最大 1MB
 * - 檔案格式: JPEG 或 PNG
 * - 最多上傳6張圖片
 * - 路由參數: product_id (商品ID)
 * - 表單欄位: isPrimary (主要圖片的索引，可選，預設為0)
 */
router.post('/:product_id/images', verifyToken, (req, res, next) => {
  // 包裝 multer middleware 以正確處理錯誤
  upload.array('productImages', 6)(req, res, (err) => {
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
              message: '未預期的檔案欄位，請使用 productImages 欄位名稱'
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              status: false,
              message: '最多只能上傳6張圖片'
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
  let localFilePaths = [];
  
  try {
    // 檢查商品 ID
    const productId = req.params.product_id;
    if (!productId) {
      return res.status(400).json({
        status: false,
        message: '缺少商品 ID'
      });
    }

    // 檢查是否有檔案上傳
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        message: '請選擇要上傳的圖片'
      });
    }

    // 取得本地檔案資訊
    localFilePaths = req.files.map(file => file.path);
    const files = req.files;

    // 取得主要圖片索引（從表單資料中）
    const isPrimary = req.body.isPrimary ? parseInt(req.body.isPrimary) : 0;
    
    // 驗證主要圖片索引
    if (isPrimary < 0 || isPrimary >= files.length) {
      await deleteLocalFiles(localFilePaths);
      return res.status(400).json({
        status: false,
        message: `主要圖片索引無效，應該在 0 到 ${files.length - 1} 之間`
      });
    }

    // 上傳所有檔案到 GCP
    const uploadPromises = files.map(file => 
      uploadToGCP(file.path, file.filename, file.mimetype, productId)
    );
    
    const uploadResults = await Promise.allSettled(uploadPromises);
    
    // 檢查是否有上傳失敗的檔案
    const failedUploads = uploadResults.filter(result => 
      result.status === 'rejected' || !result.value.status
    );
    
    if (failedUploads.length > 0) {
      // 有檔案上傳失敗，刪除本地檔案
      await deleteLocalFiles(localFilePaths);
      return res.status(500).json({
        status: false,
        message: `有 ${failedUploads.length} 個檔案上傳到雲端失敗`
      });
    }

    // 所有檔案上傳成功，處理結果
    const successfulUploads = uploadResults.map(result => result.value);
    
    // 儲存圖片資訊到資料庫
    const productImageRepository = dataSource.getRepository("ProductImages");
    
    // 準備要插入的圖片資料
    const imageDataToInsert = successfulUploads.map((uploadResult, index) => ({
      product_id: parseInt(productId),
      image_url: uploadResult.publicUrl,
      is_primary: index === isPrimary
    }));
    
    // 批量插入圖片資料
    await productImageRepository.save(imageDataToInsert);
    
    // 成功後刪除本地臨時檔案
    await deleteLocalFiles(localFilePaths);
    
    // 找出主要圖片和其他圖片
    const primaryImage = successfulUploads[isPrimary];
    const otherImages = successfulUploads.filter((_, index) => index !== isPrimary);
    
    res.status(200).json({
      status: true,
      message: '商品圖片上傳成功',
      data: {
        mainImageUrl: primaryImage.publicUrl,
        imageUrls: otherImages.map(upload => upload.publicUrl)
      }
    });
    
  } catch (error) {
    console.error('Product images upload processing error:', error);
    
    // 發生錯誤時清理本地檔案
    if (localFilePaths.length > 0) {
      await deleteLocalFiles(localFilePaths);
    }
    
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，請稍後再試"
    });
  }
});

module.exports = router;
