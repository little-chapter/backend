const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Admin");
const {
    isNotValidString,
    isNotValidInteger,
    isValidDateStr,
    isValidEmail,
} = require("../utils/validUtils");
const { verifyToken, verifyAdmin } = require("../middlewares/auth");
const { Not } = require("typeorm");
const validator = require("validator");
const { default: isBoolean } = require("validator/lib/isBoolean");

function formatDateToYYYYMMDD(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始，所以要 + 1，並補零
    const day = String(date.getDate()).padStart(2, "0"); // 補零
    return `${year}-${month}-${day}`;
}
function toBoolean(value){
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return false;
}

// 取得後台首頁的銷售統計
router.get("/dashboard", verifyToken, verifyAdmin, async(req, res, next)=>{
  try{
    // const ordersRepo = dataSource.getRepository("Orders");
    // const revenue = await ordersRepo.sum({
    //   where:{}
    // });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 0-based
    const currentMonth = `${year}年${month}月`;

    const currentMonthStart = new Date(`${year}-${month}-01`);  // 會顯示為 UTC+0 的時間，但是台灣是 UTC+8
    const lastMonthStart = new Date(`${year}-${month - 1}-01`); // @要確認訂單創建的時間是 UTC+0 或 +8
    const nextMonthStart = new Date(`${year}-${month + 1}-01`); 


    res.status(200).json({
      "status": true,
      "data": {
        "summary": {
          "revenue": 15231.89,  // 本月收入
          // revenueGrowth,        // 與上月比收入成長
          "bookSales": 2350,    // 本月書籍銷量
          // bookSalesGrowth,      // 與上月比書籍銷售成長
          "totalOrders": 573,   // 訂單數量
          // orderGrowth,          // 與上月比訂單成長
          currentMonth // 當前年月
        },
        "monthlySales": {
          "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          "revenue": [12500, 13200, 15800, 17000, 16500, 0, 0, 0, 0, 0, 0, 0],
          "orders": [11500, 12000, 14200, 15000, 16000, 0, 0, 0, 0, 0, 0, 0]
        },
        "salesByCategory": {
          "Healthy Living": 35,
          "Scientific Knowledge": 25,
          "Art Appreciation": 20,
          "Music Appreciation": 15,
          "Inspirational Growth": 5
        }
      }
    });
  } catch (error) {
    logger.error("取得取得待辦事項失敗:", error);
    next(error);
  }
});

// 管理者取得待辦事項數量
router.get("/task", verifyToken, verifyAdmin, async(req, res, next)=>{
  try{
    const ordersRepo = dataSource.getRepository("Orders");
    const countShip = await ordersRepo.count({
      where:{"order_status": "pending"}
    });
    const countReturn = await ordersRepo.count({
      where:{"shipping_status": "returned"}
    });

    res.status(200).json({
      "status": true,
        "data": {
          "pendingTasks": {
            "pendingShipments": countShip,
            "pendingRefunds": countReturn,
          }
        }
    });
  } catch (error) {
    logger.error("取得取得待辦事項失敗:", error);
    next(error);
  }
});

// 管理者更新商品
router.put("/products/:productId", verifyToken, verifyAdmin, async(req, res, next)=>{
  try{
    // 讀取使用者輸入的資料（req.params, req.body）
    // 驗證使用者輸入的為有效資料。 這邊被「undefined」、「短路運算」與「型別轉換」的概念卡了半天..
    // 驗證存在資料庫
    // 驗證 isbn 與資料庫的不重複
    // 驗證商品資訊有變更
    // 將使用者輸入的資料更新至資料庫
    const { productId = null } = req.params; // 若使用者沒填，就設為 null，避免變成 undefined
    const { title = null,
            author = null,
            illustrator = null,
            publisher = null,
            isbn = null,
            description = null,
            introductionHtml = null,
            isVisible = null,
            price = null,
            discountPrice = null,
            stockQuantity = null,
            pageCount = null,
            publishDate = null,
            ageRangeId = null,
            categoryId = null,
            isNewArrival = null,
            isBestseller = null,
            isDiscount = null } = req.body;

    // 驗證使用者輸入的為有效資料
    if(!productId
    || !title 
    || !isVisible 
    || !price 
    || !stockQuantity 
    || !ageRangeId 
    || !categoryId ){
      res.status(400).json({
        "status": false,
	      "message" : "必填欄位未填寫（productId, title, isVisible, price, stockQuantity, ageRangeId, categoryId）"
      });
      return;
    }

    if(isNotValidInteger(Number(productId)) || Number.isNaN(Number(productId))){
      res.status(400).json({
        "status": false,
	      "message" : "productId 填寫未符合規則",
      });
      return;
    }
    if(title){
      if(isNotValidString(title) || title.length < 3 || title.length > 50 ){
        res.status(400).json({
          "status": false,
          "message" : "title 填寫未符合規則（至少 3 個字元，最多 50 字元）",
        });
        return;
      }
    }
    if(author){
      if(isNotValidString(author) || author.length < 2 || author.length > 50){
        res.status(400).json({
          "status": false,
          "message" : "author 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(illustrator){
      if(isNotValidString(illustrator) || illustrator.length < 2 || illustrator.length > 50){
        res.status(400).json({
          "status": false,
          "message" : "illustrator 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(publisher){
      if(isNotValidString(publisher) || publisher.length < 4 || publisher.length > 200){
        res.status(400).json({
          "status": false,
          "message" : "publisher 必須為有效的字元（至少 4 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(isbn && !validator.isISBN(isbn)){
        res.status(400).json({
          "status": false,
          "message" : "isbn 必須為有效的 ISBN 格式"
        });
        return;
    }
    if(description){
      if(isNotValidString(description) || description.length < 3 || description.length > 200){
        res.status(400).json({
          "status": false,
          "message" : "description 必須為有效的字元（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(introductionHtml){
      if(isNotValidString(introductionHtml) || introductionHtml.length < 3 || introductionHtml.length > 200){
        res.status(400).json({
          "status": false,
          "message" : "introductionHtml 必須為有效的 html 格式（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(!isBoolean(isVisible)){
      res.status(400).json({
        "status": false,
        "message": "isVisible 必須為布林格式"
      });
      return;
    }
    if(isNotValidInteger(Number(price)) || Number.isNaN(Number(price))){
      res.status(400).json({
        "status": false,
	      "message" : "price 必須為正整數"
      });
      return;
    }
    if(isNotValidInteger(Number(discountPrice)) || Number.isNaN(Number(discountPrice))){
      res.status(400).json({
        "status": false,
	      "message" : "discountPrice 必須為正整數"
      });
      return;
    }
    if(isNotValidInteger(Number(stockQuantity)) || Number.isNaN(Number(stockQuantity))){
      res.status(400).json({
        "status": false,
	      "message" : "stockQuantity 必須為正整數"
      });
      return;
    }
    if(isNotValidInteger(Number(pageCount)) || Number.isNaN(Number(pageCount))){
      res.status(400).json({
        "status": false,
	      "message" : "pageCount 必須為正整數"
      });
      return;
    }
    if(!validator.isDate(publishDate)) {
      res.status(400).json({
        "status": false,
        "message": "publishDate 必須為有效的日期格式"
      });
      return;
    }
    if(!isBoolean(isNewArrival)
    || !isBoolean(isBestseller)
    || !isBoolean(isDiscount)){
      res.status(400).json({
        "status": false,
        "message": "布林欄位格式錯誤（例如 isNewArrival, isBestseller, isDiscount）"
      });
      return;
    }
    if(isNotValidInteger(Number(ageRangeId)) || Number.isNaN(Number(ageRangeId))){
      res.status(400).json({
          "status": false,
          "message" : "ageRangeId 填寫未符合規則",
        });
        return;
    }
    if(isNotValidInteger(Number(categoryId)) || Number.isNaN(Number(categoryId))){
      res.status(400).json({
          "status": false,
          "message" : "categoryId 填寫未符合規則",
        });
        return;
    }

    // 驗證是否存在資料庫
    const productsRepo = dataSource.getRepository("Products");
    const findProduct = await productsRepo.findOne({
      where:{"id": productId}
    });
    if(!findProduct){
      res.status(404).json({
        "status": false,
	      "message" : "找不到此商品",
      });
      return;
    }
    const ageRangesRepo = dataSource.getRepository("AgeRanges");
    const findAgeRanges = await ageRangesRepo.findOne({
      where:{"id": ageRangeId}
    });
    if(!findAgeRanges){
      res.status(404).json({
        "status": false,
        "message" : "找不到此年齡分類",
      });
      return;
    }
    const categoriesRepo = dataSource.getRepository("Categories");
    const findcategories = await categoriesRepo.findOne({
      where:{"id": categoryId}
    });
    if(!findcategories){
      res.status(404).json({
        "status": false,
        "message" : "找不到此主題分類",
      });
      return;
    }

    // 驗證 isbn 不能和自己以外的商品重複
    if(isbn){
      const findIsbn = await productsRepo.findOne({
        where: {isbn}
      });
      if(findIsbn && findIsbn.id != productId){
        res.status(409).json({
          "status": false,
          "message": "ISBN 已重複，請確認"
        });
        return;
      }
    }

    // 驗證商品資訊有變更
    if(findProduct.title === (title ? title : findProduct.title)
    && findProduct.author === (author ? author : findProduct.author)
    && findProduct.illustrator === (illustrator ? illustrator : findProduct.illustrator)
    && findProduct.publisher === (publisher ? publisher : findProduct.publisher)
    && findProduct.isbn === (isbn ? isbn : findProduct.isbn)
    && findProduct.description === (description ? description : findProduct.description)
    && findProduct.introduction_html === (introductionHtml ? introductionHtml : findProduct.introduction_html)
    && findProduct.is_visible === (isVisible ? toBoolean(isVisible) : findProduct.is_visible)
    && findProduct.price === (price ? Number(price).toFixed(2) : findProduct.price)
    && findProduct.discount_price === (discountPrice ? Number(discountPrice).toFixed(2) : findProduct.discount_price)
    && findProduct.stock_quantity === (stockQuantity ? Number(stockQuantity) : findProduct.stock_quantity)
    && findProduct.page_count === (pageCount ? Number(pageCount) : findProduct.page_count)
    && findProduct.publish_date === (publishDate ? publishDate : findProduct.publish_date)
    && findProduct.age_range_id === (ageRangeId ? Number(ageRangeId) : findProduct.age_range_id)
    && findProduct.category_id === (categoryId ? Number(categoryId) : findProduct.category_id)
    && findProduct.is_new_arrival === (isNewArrival ? toBoolean(isNewArrival) : findProduct.is_new_arrival)
    && findProduct.is_bestseller === (isBestseller ? toBoolean(isBestseller) : findProduct.is_bestseller)
    && findProduct.is_discount === (isDiscount ? toBoolean(isDiscount) : findProduct.is_discount)){
      res.status(400).json({
        "status": false,
        "message": "您輸入的商品資訊未變更"
      });
      return;
    }

    // 將使用者輸入的資料更新至資料庫
    const updateProduct = await productsRepo.update(
      { "id": productId },
      { "title": title ? title : findProduct.title,
        "is_visible": toBoolean(isVisible),
        "price": price ? Number(price) : findProduct.price,
        "stock_quantity": stockQuantity ? Number(stockQuantity) : findProduct.stock_quantity,
        "age_range_id": ageRangeId ? Number(ageRangeId) : findProduct.age_range_id,
        "category_id": categoryId ? Number(categoryId) : findProduct.category_id,
        "author": author ? author : findProduct.author,
        "illustrator": illustrator ? illustrator : findProduct.illustrator,
        "publisher": publisher ? publisher : findProduct.publisher,
        "isbn": isbn ? isbn : findProduct.isbn,
        "description": description ? description : findProduct.description,
        "introduction_html": introductionHtml ? introductionHtml : findProduct.introduction_html,
        "discount_price": discountPrice ? discountPrice : findProduct.discount_price,
        "page_count": pageCount ? pageCount : findProduct.page_count,
        "publish_date": publishDate ? publishDate : findProduct.publish_date,
        "is_new_arrival": toBoolean(isNewArrival),
        "is_bestseller": toBoolean(isBestseller),
        "is_discount": toBoolean(isDiscount),
        "updated_at": new Date()
    });
    res.status(200).json({
      "status": true,
      "message": "商品更新成功"
    });

  }catch(error){
    logger.error("編輯商品失敗:", error);
    next(error);
  }
});

// 管理者新增商品
router.post("/products", verifyToken, verifyAdmin, async(req, res, next)=>{
  try{
    // 讀取使用者輸入的資料（req.body）
    // 驗證使用者輸入的為有效資料（必填、非必填欄位） 這邊被「undefined」、「短路運算」與「型別轉換」的概念卡了半天..
    // 驗證 isbn 不能重複，因為資料庫定義該欄為唯一值
    // 將使用者輸入的資料寫入資料庫
    const { title,
            author,
            illustrator,
            publisher,
            isbn,
            description,
            introductionHtml,
            isVisible,
            price,
            discountPrice,
            stockQuantity,
            pageCount,
            publishDate,
            ageRangeId,
            categoryId,
            isNewArrival,
            isBestseller,
            isDiscount } = req.body;

    // 驗證使用者輸入的為有效資料
    if(!title 
    || isVisible === undefined
    || price === undefined
    || stockQuantity === undefined
    || !ageRangeId
    || !categoryId ){
      res.status(400).json({
        "status": false,
	      "message" : "必填欄位未填寫（title, isVisible, price, stockQuantity, ageRangeId, categoryId）"
      });
      return;
    }
    if(isNotValidString(title) || title.length < 3 || title.length > 50 ){
      res.status(400).json({
        "status": false,
	      "message" : "title 填寫未符合規則（至少 3 個字元，最多 50 字元）",
      });
      return;
    }
    if(isVisible && !isBoolean(isVisible)){
      res.status(400).json({
        "status": false,
	      "message" : "isVisible 必須為布林格式",
      });
      return;
    }
    if(isNotValidInteger(Number(price)) || Number.isNaN(Number(price))){
      res.status(400).json({
        "status": false,
	      "message" : "price 必須為正整數",
      });
      return;
    }
    if(isNotValidInteger(Number(stockQuantity)) || Number.isNaN(Number(stockQuantity))){
      res.status(400).json({
        "status": false,
	      "message" : "stockQuantity 必須為正整數",
      });
      return;
    }
    if(isNotValidInteger(Number(ageRangeId)) || Number.isNaN(Number(ageRangeId))){
      res.status(400).json({
        "status": false,
	      "message" : "ageRangeId 填寫未符合規則",
      });
      return;
    }
    if(isNotValidInteger(Number(categoryId)) || Number.isNaN(Number(categoryId))){
      res.status(400).json({
        "status": false,
	      "message" : "categoryId 填寫未符合規則",
      });
      return;
    }
    const ageRangesRepo = dataSource.getRepository("AgeRanges");
    const findAgeRanges = await ageRangesRepo.findOne({
      where:{"id": ageRangeId}
    });
    if(!findAgeRanges){
      res.status(404).json({
        "status": false,
	      "message" : "找不到此年齡分類",
      });
      return;
    }
    const categoriesRepo = dataSource.getRepository("Categories");
    const findcategories = await categoriesRepo.findOne({
      where:{"id": categoryId}
    });
    if(!findcategories){
      res.status(404).json({
        "status": false,
	      "message" : "找不到此主題分類",
      });
      return;
    }
    if(author){
      if(isNotValidString(author) || author.length < 2 || author.length > 50){
        res.status(400).json({
        "status": false,
	      "message" : "author 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(illustrator){
      if(isNotValidString(illustrator) || illustrator.length < 2 || illustrator.length > 50){
        res.status(400).json({
        "status": false,
	      "message" : "illustrator 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(publisher){
      if(isNotValidString(publisher) || publisher.length < 4 || publisher.length > 200){
        res.status(400).json({
        "status": false,
	      "message" : "publisher 必須為有效的字元（至少 4 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(isbn && !validator.isISBN(isbn)){
        res.status(400).json({
        "status": false,
	      "message" : "isbn 必須為有效的 ISBN 格式"
        });
        return;
    }
    if(description){
      if(isNotValidString(description) || description.length < 3 || description.length > 200){
        res.status(400).json({
        "status": false,
	      "message" : "description 必須為有效的字元（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(introductionHtml){
      if(isNotValidString(introductionHtml) || introductionHtml.length < 3 || introductionHtml.length > 200){
        res.status(400).json({
        "status": false,
	      "message" : "introductionHtml 必須為有效的 html 格式（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(discountPrice && isNotValidInteger(Number(discountPrice)) || Number.isNaN(Number(discountPrice))){
        res.status(400).json({
        "status": false,
	      "message" : "discountPrice 必須為正整數"
        });
        return;
    }
    if(pageCount && isNotValidInteger(Number(pageCount)) || Number.isNaN(Number(pageCount))){
        res.status(400).json({
        "status": false,
	      "message" : "pageCount 必須為正整數"
        });
        return;
    }
    if(publishDate && !validator.isDate(publishDate)) {
      res.status(400).json({
        "status": false,
        "message": "publishDate 必須為有效的日期格式"
      });
      return;
    }
    if(isNewArrival !== undefined && !isBoolean(isNewArrival)
    || isBestseller !== undefined && !isBoolean(isBestseller)
    || isDiscount !== undefined && !isBoolean(isDiscount)){
      res.status(400).json({
        "status": false,
        "message": "布林欄位格式錯誤（例如 isNewArrival, isBestseller, isDiscount）"
      });
      return;
    }

    // 驗證 isbn 不能重複
    const productsRepo = dataSource.getRepository("Products");
    if(isbn){
      const findProduct = await productsRepo.findOne({
        where: {isbn}
      });
      if(findProduct){
        res.status(409).json({
          "status": false,
          "message": "ISBN 已重複，請確認"
        });
        return;
      }
    }

    // 將使用者輸入的資料寫入資料庫
    const createProduct = productsRepo.create({
      title,
      "is_visible": toBoolean(isVisible),
      "price": Number(price),
      "stock_quantity": Number(stockQuantity),
      "age_range_id": Number(ageRangeId),
      "category_id": Number(categoryId),
      "author": author ? author : null,
      "illustrator": illustrator ? illustrator : null,
      "publisher": publisher ? publisher : null,
      "isbn": isbn ? isbn : null,
      "description": description ? description : null,
      "introduction_html": introductionHtml ? introductionHtml : null,
      "discount_price": discountPrice ? discountPrice : null,
      "page_count": pageCount ? pageCount : null,
      "publish_date": publishDate ? publishDate : null,
      "is_new_arrival": toBoolean(isNewArrival),
      "is_bestseller": toBoolean(isBestseller),
      "is_discount": toBoolean(isDiscount)
    });
    await productsRepo.save(createProduct);
    res.status(201).json({
      "status": true,
      "message": "商品新增成功"
    });
  }catch(error){
    logger.error("新增商品失敗:", error);
    next(error);
  }
});

// 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// 


// 管理者登入
router.post("/log-in", async (req, res) => {
    try {
        const { email, password } = req.body;

        // 驗證 Email 格式
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                status: false,
                message: "請輸入有效的 Email",
            });
        }

        // 驗證密碼格式（8-16 個英數字元）
        const passwordRegex = /^[A-Za-z0-9]{8,16}$/;
        if (!password || !passwordRegex.test(password)) {
            return res.status(400).json({
                status: false,
                message: "密碼格式錯誤，請輸入8-16個英數字元，區分英文大小寫",
            });
        }

        const userRepo = dataSource.getRepository("User");
        const user = await userRepo
            .createQueryBuilder("user")
            .addSelect("user.password") // 預設 select: false，要顯式加入
            .where("user.email = :email", { email })
            .andWhere("user.is_admin = true") // 限定管理者
            .getOne();

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "此 Email 尚未註冊",
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                status: false,
                message: "帳戶未驗證，請先驗證 Email",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: false,
                message: "Email 或密碼錯誤",
            });
        }

        // 建立 JWT payload
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        console.log(`payload: ${payload}`);

        const expiresInSeconds = 86400; // 1 天
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: expiresInSeconds,
        });

        res.status(200).json({
            status: true,
            message: `管理員${payload.email}登入成功`,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                token,
                expiresIn: 86400,
            },
        });

    } catch (error) {
        logger.error("管理者登入錯誤:", error);
        res.status(500).json({
            status: false,
            message: "伺服器錯誤，請稍後再試",
        });
    }
});

// 管理者取得個人資料
router.get("/profile", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        // 從中介軟體取得使用者資訊
        const userId = req.user.id;

        // 從資料庫取得完整的使用者資料
        const userRepository = dataSource.getRepository("User");
        const user = await userRepository.findOne({
            where: { id: userId },
            select: ["id", "name", "email", "is_admin"],
        });

        // 檢查使用者是否存在
        if (!user) {
            return res.status(401).json({
                status: false,
                message: "Token 無效或過期，請重新登入",
            });
        }

        // 檢查是否為管理員
        if (!req.user.is_admin) {
            return res.status(403).json({
                status: false,
                message: "權限不足，無法存取此資訊",
            });
        }

        // 回傳管理者資料
        res.status(200).json({
            status: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.is_admin ? "admin" : "customer",
                },
            },
        });
    } catch (error) {
        logger.error("取得管理者資料失敗:", error);
        next(error);
    }
});

// 管理者取得分類列表
router.get("/categories", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        // 預處理參數，將空字串轉為 undefined
        if (req.query.page === "") {
            req.query.page = undefined;
        }
        if (req.query.limit === "") {
            req.query.limit = undefined;
        }

        // 驗證page和limit參數是否為有效格式
        if (req.query.page !== undefined && isNaN(Number(req.query.page))) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        if (req.query.limit !== undefined && isNaN(Number(req.query.limit))) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        // 驗證 page 和 limit 不為零
        if (req.query.page !== undefined && Number(req.query.page) === 0) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        if (req.query.limit !== undefined && Number(req.query.limit) === 0) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        // 取得分頁參數，設定預設值
        const page = req.query.page !== undefined ? Number(req.query.page) : 1;
        const limit = req.query.limit !== undefined ? Number(req.query.limit) : 5;

        // 驗證分頁參數範圍
        if (
            isNotValidInteger(page) ||
            page < 1 ||
            isNotValidInteger(limit) ||
            limit < 1
        ) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        // 計算分頁偏移量
        const offset = (page - 1) * limit;

        // 查詢分類總數
        const totalCount = await dataSource.getRepository("Categories").count();

        // 計算總頁數
        const totalPages = Math.ceil(totalCount / limit);

        // 查詢分類資料，包含每個分類的書籍數量
        const categoriesQuery = dataSource
            .getRepository("Categories")
            .createQueryBuilder("categories")
            .select([
                "categories.id AS id",
                "categories.name AS name",
                "categories.is_visible AS is_visible",
                "(SELECT COUNT(*) FROM products WHERE products.category_id = categories.id) AS books_count",
            ])
            .orderBy("categories.id", "ASC")
            .limit(limit)
            .offset(offset);

        const categories = await categoriesQuery.getRawMany();

        // 格式化響應數據
        const formattedCategories = categories.map((category) => ({
            id: category.id,
            name: category.name,
            booksCount: parseInt(category.books_count),
            status: category.is_visible ? "Enabled" : "Disabled",
        }));

        // 返回分頁和分類數據
        res.status(200).json({
            status: true,
            data: {
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    totalPages,
                },
                categories: formattedCategories,
            },
        });
    } catch (error) {
        logger.error("取得分類列表失敗:", error);
        next(error);
    }
});

// 管理者取得類別詳細資訊
router.get(
    "/categories/:categoryId",
    verifyToken,
    verifyAdmin,
    async (req, res, next) => {
        try {
            const { categoryId } = req.params;

            // 驗證categoryId是否為有效整數
            if (isNotValidInteger(Number(categoryId)) || Number(categoryId) <= 0) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            // 查詢指定ID的分類資訊
            const category = await dataSource.getRepository("Categories").findOne({
                where: { id: Number(categoryId) },
            });

            // 如果找不到該分類，返回404
            if (!category) {
                return res.status(404).json({
                    status: false,
                    message: "查無此分類資料",
                });
            }

            // 格式化響應數據
            const formattedCategory = {
                categoryId: category.id,
                name: category.name,
                description: category.description || "", // 處理可能為null的情況
                status: category.is_visible ? "Enabled" : "Disabled",
            };

            // 返回分類詳細資訊
            res.status(200).json({
                status: true,
                data: formattedCategory,
            });
        } catch (error) {
            logger.error("取得類別詳細資訊失敗:", error);
            next(error);
        }
    }
);

// 管理者新增商品分類
router.post("/categories", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        const { name, description, status } = req.body;

        // 驗證必要欄位是否存在
        if (!name || !description || !status) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        // 驗證欄位格式
        if (isNotValidString(name) || name.length < 4 || name.length > 10) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        if (isNotValidString(description) || description.length > 100) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        if (isNotValidString(status) || !["Enabled", "Disabled"].includes(status)) {
            return res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
        }

        // 檢查分類名稱是否已存在
        const existingCategory = await dataSource
            .getRepository("Categories")
            .findOne({
                where: { name },
            });

        if (existingCategory) {
            return res.status(400).json({
                status: false,
                message: "商品分類名稱已存在",
            });
        }

        // 轉換 status 為 is_visible
        const is_visible = status === "Enabled";

        // 建立新分類
        const newCategory = dataSource.getRepository("Categories").create({
            name,
            description,
            is_visible,
            display_order: 1, // 使用預設值
        });

        // 儲存到資料庫
        const savedCategory = await dataSource
            .getRepository("Categories")
            .save(newCategory);

        // 格式化回傳資料
        const responseData = {
            categoryId: savedCategory.id,
            name: savedCategory.name,
            description: savedCategory.description,
            status: savedCategory.is_visible ? "Enabled" : "Disabled",
        };

        return res.status(200).json({
            status: true,
            data: responseData,
        });
    } catch (error) {
        logger.error("新增商品分類失敗:", error);
        next(error);
    }
});

// 管理者編輯商品分類
router.put(
    "/categories/:categoryId",
    verifyToken,
    verifyAdmin,
    async (req, res, next) => {
        try {
            const { categoryId } = req.params;
            const { name, description, status } = req.body;

            // 驗證categoryId是否為有效整數
            if (isNotValidInteger(Number(categoryId)) || Number(categoryId) <= 0) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            // 驗證必要欄位是否存在
            if (!name || !description || !status) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            // 驗證欄位格式
            if (isNotValidString(name) || name.length < 4 || name.length > 10) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            if (isNotValidString(description) || description.length > 100) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            if (
                isNotValidString(status) ||
                !["Enabled", "Disabled"].includes(status)
            ) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            // 檢查分類是否存在
            const existingCategory = await dataSource
                .getRepository("Categories")
                .findOne({
                    where: { id: Number(categoryId) },
                });

            if (!existingCategory) {
                return res.status(404).json({
                    status: false,
                    message: "查無此分類資料",
                });
            }

            // 檢查分類名稱是否與其他分類重複
            const duplicateCategory = await dataSource
                .getRepository("Categories")
                .findOne({
                    where: { name, id: Not(Number(categoryId)) },
                });

            if (duplicateCategory) {
                return res.status(400).json({
                    status: false,
                    message: "商品分類名稱已存在",
                });
            }

            // 轉換 status 為 is_visible
            const is_visible = status === "Enabled";

            // 更新分類
            existingCategory.name = name;
            existingCategory.description = description;
            existingCategory.is_visible = is_visible;

            // 儲存到資料庫
            const updatedCategory = await dataSource
                .getRepository("Categories")
                .save(existingCategory);

            // 格式化回傳資料
            const responseData = {
                categoryId: updatedCategory.id,
                name: updatedCategory.name,
                description: updatedCategory.description,
                status: updatedCategory.is_visible ? "Enabled" : "Disabled",
            };

            return res.status(200).json({
                status: true,
                data: responseData,
            });
        } catch (error) {
            logger.error("編輯商品分類失敗:", error);
            next(error);
        }
    }
);

// 管理者刪除商品分類
router.delete(
    "/categories/:categoryId",
    verifyToken,
    verifyAdmin,
    async (req, res, next) => {
        try {
            const { categoryId } = req.params;

            // 驗證categoryId是否為有效整數
            if (isNotValidInteger(Number(categoryId)) || Number(categoryId) <= 0) {
                return res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
            }

            // 檢查分類是否存在
            const existingCategory = await dataSource
                .getRepository("Categories")
                .findOne({
                    where: { id: Number(categoryId) },
                });

            if (!existingCategory) {
                return res.status(404).json({
                    status: false,
                    message: "查無此分類資料",
                });
            }

            // 檢查分類是否有關聯的商品
            const productsCount = await dataSource.getRepository("Products").count({
                where: { category_id: Number(categoryId) },
            });

            if (productsCount > 0) {
                return res.status(409).json({
                    status: false,
                    message: "無法刪除商品分類，請檢查分類是否仍有商品",
                });
            }

            // 執行刪除操作
            await dataSource.getRepository("Categories").delete(Number(categoryId));

            return res.status(200).json({
                status: true,
                message: "刪除成功",
            });
        } catch (error) {
            logger.error("刪除商品分類失敗:", error);
            next(error);
        }
    }
);

router.get("/orders", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        const allowedFilters = {
            page: "number",
            limit: "number",
            startDate: "string",
            endDate: "string",
            orderStatus: "string",
            paymentStatus: "string",
            shippingStatus: "string",
            userEmail: "string",
            orderNumber: "string",
            sortBy: "string",
            sortOrder: "string",
        };
        const allowedOrderStatus = [
            "created",
            "pending",
            "shipped",
            "completed",
            "cancelled",
        ];
        const allowedPaymentStatus = ["unpaid", "paid", "refunded"];
        const allowedShippingStatus = [
            "notReceived",
            "processing",
            "inTransit",
            "delivered",
            "returned",
        ];
        const allowedSortBy = {
            createdAt: "created_at",
            finalAmount: "final_amount",
        };
        const allowedSortOrder = ["DESC", "ASC"];
        const filters = req.query;
        for (const key of Object.keys(filters)) {
            if (!(key in allowedFilters)) {
                res.status(400).json({
                    status: false,
                    message: "不支援的搜尋條件",
                });
                return;
            }
            const exceptedType = allowedFilters[key];
            const value = filters[key];
            if (exceptedType === "number") {
                if (
                    !value ||
                    isNotValidInteger(Number(value)) ||
                    Number.isNaN(Number(value))
                ) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
            }
            if (exceptedType === "string") {
                if (!value || isNotValidString(value)) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                //日期格式驗證
                if (
                    (key === "startDate" || key === "endDate") &&
                    !isValidDateStr(value)
                ) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (key === "orderStatus" && !allowedOrderStatus.includes(value)) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (key === "paymentStatus" && !allowedPaymentStatus.includes(value)) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (
                    key === "shippingStatus" &&
                    !allowedShippingStatus.includes(value)
                ) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (key === "userEmail" && !isValidEmail(value)) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (key === "sortBy" && !(value in allowedSortBy)) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
                if (
                    key === "sortOrder" &&
                    !allowedSortOrder.includes(value.toUpperCase())
                ) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return;
                }
            }
        }
        let orderQuery = dataSource
            .getRepository("Orders")
            .createQueryBuilder("orders")
            .innerJoin("orders.User", "user")
            .select([
                "orders.order_number AS order_number",
                "user.name AS username",
                "orders.final_amount AS final_amount",
                "orders.order_status AS order_status",
                "orders.payment_status AS payment_status",
                "orders.shipping_status AS shipping_status",
                "orders.created_at AS created_at",
            ]);
        //起始日期 結束日期
        if (filters.startDate && filters.endDate) {
            if (filters.startDate > filters.endDate) {
                res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
                return;
            }
            const start = new Date(filters.startDate + "T00:00:00.000");
            const end = new Date(filters.endDate + "T23:59:59.999");
            orderQuery = orderQuery.andWhere(
                "orders.created_at BETWEEN :start AND :end",
                { start: start, end: end }
            );
        }
        if (filters.startDate && !filters.endDate) {
            const start = new Date(filters.startDate + "T00:00:00.000");
            orderQuery = orderQuery.andWhere("orders.created_at >=:start", {
                start: start,
            });
        }
        if (!filters.startDate && filters.endDate) {
            const end = new Date(filters.endDate + "T23:59:59.999");
            orderQuery = orderQuery.andWhere("orders.created_at <=:end", {
                end: end,
            });
        }
        if (filters.orderStatus) {
            orderQuery = orderQuery.andWhere("orders.order_status =:orderStatus", {
                orderStatus: filters.orderStatus,
            });
        }
        if (filters.paymentStatus) {
            orderQuery = orderQuery.andWhere(
                "orders.payment_status =:paymentStatus",
                { paymentStatus: filters.paymentStatus }
            );
        }
        if (filters.shippingStatus) {
            orderQuery = orderQuery.andWhere(
                "orders.shipping_status =:shippingStatus",
                { shippingStatus: filters.shippingStatus }
            );
        }
        if (filters.userEmail) {
            orderQuery = orderQuery.andWhere("user.email =:Email", {
                Email: filters.userEmail,
            });
        }
        if (filters.orderNumber) {
            orderQuery = orderQuery.andWhere("orders.order_number =:orderNumber", {
                orderNumber: filters.orderNumber,
            });
        }
        //排序依據
        let sortBy = "created_at";
        let sortOrder = "DESC";
        if (filters.sortBy) {
            sortBy = allowedSortBy[filters.sortBy];
        }
        if (filters.sortOrder) {
            sortOrder = filters.sortOrder.toUpperCase();
        }
        orderQuery = orderQuery.orderBy(`orders.${sortBy}`, sortOrder);
        //總筆數
        const countQuery = orderQuery.clone();
        const count = await countQuery.getCount();
        //分頁
        let page = 1;
        let limit = 20;
        if (filters.page && Number(filters.page) > page) {
            page = Number(filters.page);
        }
        if (filters.limit && Number(filters.limit) >= 1) {
            limit = Number(filters.limit);
        }
        const totalPages = Math.max(1, Math.ceil(count / limit));
        if (page > totalPages) {
            page = totalPages;
        }
        const skip = (page - 1) * limit;
        const ordersData = await orderQuery.offset(skip).limit(limit).getRawMany();
        const ordersResult = ordersData.map((order) => {
            return {
                orderNumber: order.order_number,
                userName: order.username,
                finalAmount: parseInt(order.final_amount),
                orderStatus: order.order_status,
                paymentStatus: order.payment_status,
                shippingStatus: order.shipping_status,
                createdAt: formatDateToYYYYMMDD(order.created_at),
            };
        });
        res.status(200).json({
            status: true,
            data: {
                pagination: {
                    page: page,
                    limit: limit,
                    totalPages: totalPages,
                },
                orders: ordersResult,
            },
        });
    } catch (error) {
        logger.error("取得用戶訂單列表錯誤:", error);
        next(error);
    }
});

router.get(
    "/orders/:orderNumber",
    verifyToken,
    verifyAdmin,
    async (req, res, next) => {
        try {
            const { orderNumber } = req.params;
            if (!orderNumber || isNotValidString(orderNumber)) {
                res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
                return;
            }
            const existOrder = await dataSource
                .getRepository("Orders")
                .findOneBy({ order_number: orderNumber });
            if (!existOrder) {
                res.status(404).json({
                    status: false,
                    message: "找不到此訂單",
                });
                return;
            }
            const orderData = await dataSource
                .getRepository("Orders")
                .createQueryBuilder("orders")
                .innerJoin(
                    "PaymentTransactions",
                    "pt",
                    "pt.merchant_order_no =:merchantOrderNo",
                    { merchantOrderNo: orderNumber }
                )
                .select([
                    "orders.id AS id",
                    "orders.order_number AS order_number",
                    "orders.order_status AS order_status",
                    "orders.shipping_status AS shipping_status",
                    "orders.payment_status AS payment_status",
                    "orders.payment_method AS payment_method",
                    "pt.transaction_number AS transaction_number",
                    "orders.total_amount AS total_amount",
                    "orders.shipping_fee AS shipping_fee",
                    "orders.discount_amount AS discount_amount",
                    "orders.final_amount AS final_amount",
                    "orders.note AS note",
                    "orders.status_note AS status_note",
                    "orders.recipient_name AS recipient_name",
                    "orders.recipient_phone AS recipient_phone",
                    "orders.shipping_method AS shipping_method",
                    "orders.shipping_address AS shipping_address",
                    "orders.store_code AS store_code",
                    "orders.store_name AS store_name",
                ])
                .where("orders.order_number =:orderNumber", {
                    orderNumber: orderNumber,
                })
                .getRawOne();
            const orderItems = await dataSource
                .getRepository("OrderItems")
                .createQueryBuilder("orderItems")
                .select([
                    "orderItems.product_title AS title",
                    "orderItems.quantity AS quantity",
                    "orderItems.price AS price",
                    "orderItems.subtotal AS subtotal",
                ])
                .where("orderItems.order_id =:orderId", { orderId: orderData.id })
                .getRawMany();
            const itemsResult = orderItems.map((item) => {
                return {
                    productTitle: item.title,
                    quantity: item.quantity,
                    price: parseInt(item.price),
                    subtotal: parseInt(item.subtotal),
                };
            });
            res.status(200).json({
                status: true,
                data: {
                    orderNumber: orderData.order_number,
                    orderStatus: orderData.order_status,
                    shippingStatus: orderData.shipping_status,
                    paymentStatus: orderData.payment_status,
                    paymentMethod: orderData.payment_method,
                    transactionNumber: orderData.transaction_number,
                    totalAmount: parseInt(orderData.total_amount),
                    shippingFee: parseInt(orderData.shipping_fee),
                    discountAmount: parseInt(orderData.discount_amount),
                    finalAmount: parseInt(orderData.final_amount),
                    note: orderData.note,
                    statusNote: orderData.status_note,
                    shippingInfo: {
                        recipientName: orderData.recipient_name,
                        recipientPhone: orderData.recipient_phone,
                        shippingMethod: orderData.shipping_method,
                        shippingAddress: orderData.shipping_address,
                        storeCode: orderData.store_code,
                        storeName: orderData.store_name,
                    },
                    items: itemsResult,
                },
            });
        } catch (error) {
            logger.error("取得用戶訂單詳細錯誤:", error);
            next(error);
        }
    }
);

//更新訂單狀態
router.put(
    "/orders/:orderNumber/status",
    verifyToken,
    verifyAdmin,
    async (req, res, next) => {
        try {
            const { orderNumber } = req.params;
            const { orderStatus, statusNote } = req.body;
            if (
                !orderNumber ||
                isNotValidString(orderNumber) ||
                !orderStatus ||
                isNotValidString(orderStatus)
            ) {
                res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
                return;
            }
            if (statusNote && typeof statusNote !== "string") {
                res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符",
                });
                return;
            }
            const existOrder = await dataSource
                .getRepository("Orders")
                .findOneBy({ order_number: orderNumber });
            if (!existOrder) {
                res.status(404).json({
                    status: false,
                    message: "找不到該訂單",
                });
                return;
            }
            if (
                (orderStatus === "shipped" &&
                    existOrder.order_status === "pending" &&
                    existOrder.payment_status === "paid" &&
                    existOrder.shipping_status === "notReceived") ||
                (orderStatus === "completed" &&
                    existOrder.order_status === "shipped" &&
                    existOrder.payment_status === "paid" &&
                    existOrder.shipping_status === "delivered") ||
                (orderStatus === "cancelled" &&
                    existOrder.order_status === "pending" &&
                    existOrder.payment_status === "paid" &&
                    existOrder.shipping_status === "notReceived") ||
                (orderStatus === "cancelled" &&
                    existOrder.order_status === "completed" &&
                    existOrder.payment_status === "paid" &&
                    existOrder.shipping_status === "returned")
            ) {
                const result = await dataSource
                    .getRepository("Orders")
                    .createQueryBuilder("orders")
                    .update()
                    .set({
                        order_status: orderStatus,
                        status_note: statusNote,
                        cancelled_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .where("orders.order_number =:orderNumber", {
                        orderNumber: orderNumber,
                    })
                    .execute();
                if (result.affected !== 1) {
                    res.status(422).json({
                        status: false,
                        message: "訂單更新失敗",
                    });
                    return;
                }
                res.status(200).json({
                    status: true,
                    message: "訂單狀態更新成功",
                });
            } else {
                res.status(400).json({
                    status: false,
                    message: "無效的訂單狀態或狀態轉換不被允許",
                });
            }
        } catch (error) {
            logger.error("更新用戶訂單狀態錯誤:", error);
            next(error);
        }
    }
);
router.get("/products", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        let filters = req.query;
        const allowedFilters = {
            page: "number",
            limit: "number",
            categoryId: "number",
            ageRangeId: "number",
            isVisible: "boolean"
        };
        for (const key of Object.keys(filters)) {
            if (!(key in allowedFilters)) {
                res.status(400).json({
                    status: false,
                    message: "不支援的搜尋條件"
                })
                return
            }

            const expectedType = allowedFilters[key];
            const value = filters[key];
            if (expectedType === "number") {
                if (!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符"
                    })
                    return
                }
            }
            if (expectedType === "boolean") {
                if (!value || !(value === "true" || value === "false")) {
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符"
                    })
                    return
                }
            }
        }
        let productQuery = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .innerJoin("products.Categories", "categories")
            .innerJoin("products.AgeRanges", "ageRanges")
            .leftJoin("ProductImages", "image", "image.product_id = products.id", "image.is_primary =:isPrimary", { isPrimary: true })
            .select([
                "products.id AS id",
                "image.image_url AS imageurl",
                "products.title AS title",
                "products.author AS author",
                "products.price AS price",
                "products.stock_quantity AS stock_quantity",
                "products.is_visible AS is_visible",
                "categories.id AS categories_id",
                "ageRanges.id AS age_ranges_id"
            ])
        if (filters.categoryId) {
            const categoryId = Number(filters.categoryId);
            const existCategory = await dataSource.getRepository("Categories").findOneBy({ id: categoryId });
            if (!existCategory) {
                res.status(404).json({
                    status: false,
                    message: "找不到此主題分類"
                })
                return
            }
            productQuery = productQuery
                .andWhere("categories.id =:categoryId", { categoryId: categoryId })
        }
        if (filters.ageRangeId) {
            const ageRangeId = Number(filters.ageRangeId);
            const existAgeRange = await dataSource.getRepository("AgeRanges").findOneBy({ id: ageRangeId });
            if (!existAgeRange) {
                res.status(404).json({
                    status: false,
                    message: "找不到此年齡分類"
                })
                return
            }
            productQuery = productQuery
                .andWhere("ageRanges.id =:ageRangesId", { ageRangesId: ageRangeId })
        }
        if (filters.isVisible) {
            const isVisible = filters.isVisible;
            productQuery = productQuery
                .andWhere("products.is_visible =:isVisible", { isVisible: isVisible })
        }
        productQuery = productQuery
            .orderBy("products.id", "ASC")
        const countQuery = productQuery.clone();
        const count = await countQuery.getCount();
        let page = 1;
        let limit = 5;
        if (filters.page && Number(filters.page) > 1) {
            page = Number(filters.page);
        }
        if (filters.limit && Number(filters.limit) >= 1) {
            limit = Number(filters.limit);
        }
        let totalPages = Math.max(1, Math.ceil(count / limit));
        if (page > totalPages) {
            page = totalPages
        }
        const skip = (page - 1) * limit;
        const productsData = await productQuery
            .offset(skip)
            .limit(limit)
            .getRawMany();
        const productResult = productsData.map(product => {
            return {
                id: product.id,
                mainImageUrl: product.imageurl,
                title: product.title,
                author: product.author,
                price: parseInt(product.price),
                stockQuantify: product.stock_quantity,
                isVisible: product.is_visible,
                categoryId: product.categories_id,
                ageRangeId: product.age_ranges_id
            }
        })
        res.status(200).json({
            status: true,
            data: {
                pagination: {
                    page: page,
                    limit: limit,
                    total: count,
                    totalPages: totalPages
                },
                products: productResult
            }
        })
    } catch (error) {
        logger.error("取得商品列表錯誤:", error);
        next(error);
    }
})
router.get("/products/:productId", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        const { productId } = req.params;
        if (!productId || isNotValidInteger(Number(productId)) || Number.isNaN(Number(productId))) {
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符"
            })
            return
        }
        const existProduct = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .where("products.id =:productId", { productId: productId })
            .getExists();
        if (!existProduct) {
            res.status(404).json({
                status: false,
                message: "找不到此商品"
            })
            return
        }
        const productData = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .innerJoin("products.AgeRanges", "ageranges")
            .innerJoin("products.Categories", "categories")
            .select([
                "products.id AS id",
                "products.title AS title",
                "products.author AS author",
                "products.publisher AS publisher",
                "products.isbn AS isbn",
                "products.price AS price",
                "products.discount_price AS discount_price",
                "products.stock_quantity AS stock_quantity",
                "products.page_count AS page_count",
                "products.publish_date AS publish_date",
                "ageranges.name AS ageranges_name",
                "categories.name AS category_name",
                "products.introduction_html AS introduction_html",
                "products.is_new_arrival AS is_new_arrival",
                "products.is_bestseller AS is_bestseller",
                "products.is_discount AS is_discount",
                "products.is_visible AS is_visible",
            ])
            .where("products.id =:productId", { productId: productId })
            .getRawOne();
        const imageData = await dataSource.getRepository("ProductImages")
            .createQueryBuilder("image")
            .select([
                "image_url",
                "is_primary"
            ])
            .where("image.product_id =:productId", { productId: productId })
            .getRawMany();
        const imageResult = imageData.map(data => {
            return {
                imageUrl: data.image_url,
                isPrimary: data.is_primary
            }
        })
        res.status(200).json({
            status: true,
            data: {
                id: productData.id,
                title: productData.title,
                author: productData.author,
                illustrator: productData.illustrator,
                publisher: productData.publisher,
                isbn: productData.isbn,
                price: parseInt(productData.price),
                discountPrice: parseInt(productData.discount_price),
                stockQuantity: productData.stock_quantity,
                pageCount: productData.page_count,
                publishDate: formatDateToYYYYMMDD(productData.publish_date),
                ageRangeName: productData.ageranges_name,
                categoryName: productData.category_name,
                introductionHtml: productData.introduction_html,
                isNewArrival: productData.is_new_arrival,
                isBestseller: productData.is_bestseller,
                isDiscount: productData.is_discount,
                isVisible: productData.is_visible,
                imageUrls: imageResult
            }
        })
    } catch (error) {
        logger.error("取得商品詳細錯誤:", error);
        next(error);
    }
})
module.exports = router;
