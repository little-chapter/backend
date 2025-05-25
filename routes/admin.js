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
      "status": "true",
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
      where:{"order_status": "待出貨"}
    });
    const countReturn = await ordersRepo.count({
      where:{"shipping_status": "退貨"}
    });
    const notificationsRepo = dataSource.getRepository("Notifications");
    const countNotifications = await notificationsRepo.count({
      where:{"is_read": false, "is_deleted": false} // 不確定是不是這樣
    });

    res.status(200).json({
      "status": "true",
        "data": {
          "pendingTasks": {
            "pendingShipments": countShip,
            "pendingRefunds": countReturn,
            "recentNotifications": countNotifications
          }
        }
    });
  } catch (error) {
    logger.error("取得取得待辦事項失敗:", error);
    next(error);
  }
});
// 管理者編輯商品
router.put("/products/:productId", verifyToken, verifyAdmin, async(req, res, next)=>{
  try{
    // 讀取使用者輸入的資料（req.params, req.body）
    // 驗證使用者輸入的為有效資料（必填、非必填欄位） 這邊被「undefined」、「短路運算」與「型別轉換」的概念卡了半天..
    // 驗證 isbn 不能和自己以外的商品重複，因為資料庫定義該欄為唯一值
    // 驗證商品資訊有變更
    // 將使用者輸入的資料更新至資料庫
    const { productId } = req.params;
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

    // 驗證必填欄位為有效資料
    const productsRepo = dataSource.getRepository("Products");
    const findProduct = await productsRepo.findOne({
      where:{"id": productId}
    });
    if(!findProduct){
      res.status(404).json({
        "status" : "false",
	      "message" : "找不到此商品",
      });
      return;
    }
    if(!title || isNotValidString(title)
    || isVisible === undefined || !isBoolean(isVisible)
    || price === undefined || isNotValidInteger(Number(price))
    || stockQuantity === undefined || isNotValidInteger(Number(stockQuantity))
    || !ageRangeId || isNotValidInteger(Number(ageRangeId))
    || !categoryId || isNotValidInteger(Number(categoryId)) ){
      res.status(400).json({
        "status" : "false",
	      "message" : "欄位未填寫正確",
      });
      return;
    }
    if(title.length < 3 || title.length > 50 ){
      res.status(400).json({
        "status" : "false",
	      "message" : "title 填寫未符合規則（至少 3 個字元，最多 50 字元）",
      });
      return;
    }
    const ageRangesRepo = dataSource.getRepository("AgeRanges");
    const findAgeRanges = await ageRangesRepo.findOne({
      where:{"id": ageRangeId}
    });
  
    if(!findAgeRanges){
      res.status(400).json({
        "status" : "false",
	      "message" : "ageRangeId 填寫未符合規則",
      });
      return;
    }
    const categoriesRepo = dataSource.getRepository("Categories");
    const findcategories = await categoriesRepo.findOne({
      where:{"id": categoryId}
    });
    if(!findcategories){
      res.status(400).json({
        "status" : "false",
	      "message" : "categoryId 填寫未符合規則",
      });
      return;
    }
    
    // 驗證非必填欄位為有效資料
    if(author){
      if(isNotValidString(author) || author.length < 2 || author.length > 50){
        res.status(400).json({
        "status" : "false",
	      "message" : "author 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(illustrator){
      if(isNotValidString(illustrator) || illustrator.length < 2 || illustrator.length > 50){
        res.status(400).json({
        "status" : "false",
	      "message" : "illustrator 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(publisher){
      if(isNotValidString(publisher) || publisher.length < 4 || publisher.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "publisher 必須為有效的字元（至少 4 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(isbn && !validator.isISBN(isbn)){
        res.status(400).json({
        "status" : "false",
	      "message" : "isbn 必須為有效的 ISBN 格式"
        });
        return;
    }
    if(description){
      if(isNotValidString(description) || description.length < 3 || description.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "description 必須為有效的字元（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(introductionHtml){
      if(isNotValidString(introductionHtml) || introductionHtml.length < 3 || introductionHtml.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "introductionHtml 必須為有效的 html 格式（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(discountPrice && isNotValidInteger(discountPrice)){
        res.status(400).json({
        "status" : "false",
	      "message" : "discountPrice 必須為正整數"
        });
        return;
    }
    if(pageCount && isNotValidInteger(pageCount)){
        res.status(400).json({
        "status" : "false",
	      "message" : "pageCount 必須為正整數"
        });
        return;
    }
    if (publishDate && !validator.isDate(publishDate)) {
      return res.status(400).json({
        "status": "false",
        "message": "publishDate 必須為有效的日期格式"
      });
    }
    if (isNewArrival !== undefined && !isBoolean(isNewArrival)
    || isBestseller !== undefined && !isBoolean(isBestseller)
    || isDiscount !== undefined && !isBoolean(isDiscount)){
      res.status(400).json({
        "status": "false",
        "message": "布林欄位格式錯誤（例如 isNewArrival, isBestseller, isDiscount）"
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
          "status": "false",
          "message": "ISBN 已重複，請確認"
        });
        return;
      }
    }

    // 驗證商品資訊有變更
    if(findProduct.title === title
      && findProduct.is_visible === toBoolean(isVisible)
      && findProduct.price === price.toFixed(2)
      && findProduct.stock_quantity === Number(stockQuantity)
      && findProduct.age_range_id === Number(ageRangeId)
      && findProduct.category_id === Number(categoryId)){
        res.status(400).json({
        "status": "false",
        "message": "您輸入的商品資訊未變更"
      });
      return;
    }

    // 將使用者輸入的資料更新至資料庫
    const updateProduct = await productsRepo.update(
      { "id": productId },
      { title,
        "is_visible": toBoolean(isVisible),
        "price": Number(price),
        "stock_quantity": Number(stockQuantity),
        "age_range_id": Number(ageRangeId),
        "category_id": Number(categoryId),
        "author": author ? author : findProduct.author,
        "illustrator": illustrator ? illustrator : findProduct.illustrator,
        "publisher": publisher ? publisher : findProduct.publisher,
        "isbn": isbn ? isbn : findProduct.isbn,
        "description": description ? description : findProduct.descriptiion,
        "introduction_html": introductionHtml ? introductionHtml : findProduct.introduction_html,
        "discount_price": discountPrice ? discountPrice : findProduct.discount_price,
        "page_count": pageCount ? pageCount : findProduct.page_count,
        "publish_date": publishDate ? publishDate : findProduct.publish_date,
        "is_new_arrival": toBoolean(isNewArrival),
        "is_bestseller": toBoolean(isBestseller),
        "is_discount": toBoolean(isDiscount)
    });

    res.status(200).json({
      "status": "ture",
      "message": "商品編輯成功"
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

    // 驗證必填欄位需為有效資料
    if(!title || isNotValidString(title)
    || isVisible === undefined || !isBoolean(isVisible)
    || price === undefined || isNotValidInteger(Number(price))
    || stockQuantity === undefined || isNotValidInteger(Number(stockQuantity))
    || !ageRangeId || isNotValidInteger(Number(ageRangeId))
    || !categoryId || isNotValidInteger(Number(categoryId)) ){
      res.status(400).json({
        "status" : "false",
	      "message" : "欄位未填寫正確",
      });
      return;
    }
    if(title.length < 3 || title.length > 50 ){
      res.status(400).json({
        "status" : "false",
	      "message" : "title 填寫未符合規則（至少 3 個字元，最多 50 字元）",
      });
      return;
    }
    const ageRangesRepo = dataSource.getRepository("AgeRanges");
    const findAgeRanges = await ageRangesRepo.findOne({
      where:{"id": ageRangeId}
    });
  
    if(!findAgeRanges){
      res.status(400).json({
        "status" : "false",
	      "message" : "ageRangeId 填寫未符合規則",
      });
      return;
    }
    const categoriesRepo = dataSource.getRepository("Categories");
    const findcategories = await categoriesRepo.findOne({
      where:{"id": categoryId}
    });
    if(!findcategories){
      res.status(400).json({
        "status" : "false",
	      "message" : "categoryId 填寫未符合規則",
      });
      return;
    }
    
    // 驗證非必填欄位需為有效資料
    if(author){
      if(isNotValidString(author) || author.length < 2 || author.length > 50){
        res.status(400).json({
        "status" : "false",
	      "message" : "author 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(illustrator){
      if(isNotValidString(illustrator) || illustrator.length < 2 || illustrator.length > 50){
        res.status(400).json({
        "status" : "false",
	      "message" : "illustrator 必須為有效的字元（至少 2 個字元，最多 50 字元）"
        });
        return;
      }
    }
    if(publisher){
      if(isNotValidString(publisher) || publisher.length < 4 || publisher.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "publisher 必須為有效的字元（至少 4 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(isbn && !validator.isISBN(isbn)){
        res.status(400).json({
        "status" : "false",
	      "message" : "isbn 必須為有效的 ISBN 格式"
        });
        return;
    }
    if(description){
      if(isNotValidString(description) || description.length < 3 || description.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "description 必須為有效的字元（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(introductionHtml){
      if(isNotValidString(introductionHtml) || introductionHtml.length < 3 || introductionHtml.length > 200){
        res.status(400).json({
        "status" : "false",
	      "message" : "introductionHtml 必須為有效的 html 格式（至少 3 個字元，最多 200 字元）"
        });
        return;
      }
    }
    if(discountPrice && isNotValidInteger(discountPrice)){
        res.status(400).json({
        "status" : "false",
	      "message" : "discountPrice 必須為正整數"
        });
        return;
    }
    if(pageCount && isNotValidInteger(pageCount)){
        res.status(400).json({
        "status" : "false",
	      "message" : "pageCount 必須為正整數"
        });
        return;
    }
    if (publishDate && !validator.isDate(publishDate)) {
      return res.status(400).json({
        "status": "false",
        "message": "publishDate 必須為有效的日期格式"
      });
    }
    if (isNewArrival !== undefined && !isBoolean(isNewArrival)
    || isBestseller !== undefined && !isBoolean(isBestseller)
    || isDiscount !== undefined && !isBoolean(isDiscount)){
      res.status(400).json({
        "status": "false",
        "message": "布林欄位格式錯誤（例如 isNewArrival, isBestseller, isDiscount）"
      });
      return;
    }
    // 驗證 isbn 不能重複
    const productsRepo = dataSource.getRepository("Products");
    const findProduct = await productsRepo.findOne({
      where: {isbn}
    });
    if(findProduct){
      res.status(409).json({
        "status": "false",
        "message": "ISBN 已重複，請確認"
      });
      return;
    }
    // 將使用者輸入的資料寫入資料庫
    const createProduct = productsRepo.create({
      // 必填欄位
      title,
      "is_visible": toBoolean(isVisible),
      "price": Number(price),
      "stock_quantity": Number(stockQuantity),
      "age_range_id": Number(ageRangeId),
      "category_id": Number(categoryId),
      // 非必填欄位
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

    res.status(200).json({
      "status": "ture",
      "message": "商品新增成功"
    });
  }catch(error){
    logger.error("新增商品失敗:", error);
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
        finalAmount: order.final_amount,
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
          "pt.transaction_id AS transaction_id",
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
          price: item.price,
          subtotal: item.subtotal,
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
          transactionId: orderData.transaction_id,
          totalAmount: orderData.total_amount,
          shippingFee: orderData.shipping_fee,
          discountAmount: orderData.discount_amount,
          finalAmount: orderData.final_amount,
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

module.exports = router;
