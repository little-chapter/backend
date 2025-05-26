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

function formatDateToYYYYMMDD(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始，所以要 + 1，並補零
  const day = String(date.getDate()).padStart(2, "0"); // 補零
  return `${year}-${month}-${day}`;
}

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
router.get("/products", verifyToken, verifyAdmin, async (req, res, next) =>{
  try{
    let filters = req.query;
    const allowedFilters = {
      page: "number",
      limit: "number",
      categoryId: "number",
      ageRangeId: "number",
      isVisible: "boolean"
    };
    for(const key of Object.keys(filters)){
      if(!(key in allowedFilters)){
        res.status(400).json({
          status: false,
          message: "不支援的搜尋條件"
        })
        return
      }
      
      const expectedType = allowedFilters[key];
      const value = filters[key];
      if(expectedType === "number"){
        if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
          res.status(400).json({
            status: false,
            message: "欄位資料格式不符"
          })
        return
        }
      }
      if(expectedType === "boolean"){
        if(!value ||  !(value === "true" || value ===  "false")){
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
      .leftJoin("ProductImages", "image", "image.product_id = products.id", "image.is_primary =:isPrimary", {isPrimary: true})
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
    if(filters.categoryId){
      const categoryId = Number(filters.categoryId);
      const existCategory = await dataSource.getRepository("Categories").findOneBy({id: categoryId});
      if(!existCategory){
        res.status(404).json({
          status: false,
          message: "找不到此主題分類"
        })
        return
      }
      productQuery = productQuery
        .andWhere("categories.id =:categoryId", {categoryId: categoryId})
    }
    if(filters.ageRangeId){
      const ageRangeId = Number(filters.ageRangeId);
      const existAgeRange = await dataSource.getRepository("AgeRanges").findOneBy({id: ageRangeId});
      if(!existAgeRange){
        res.status(404).json({
          status: false,
          message: "找不到此年齡分類"
        })
        return
      }
      productQuery = productQuery
        .andWhere("ageRanges.id =:ageRangesId", {ageRangesId: ageRangeId})
    }
    if(filters.isVisible){
      const isVisible = filters.isVisible;
      productQuery = productQuery
        .andWhere("products.is_visible =:isVisible", {isVisible: isVisible})
    }
    productQuery = productQuery
      .orderBy("products.id", "ASC")
    const countQuery = productQuery.clone();
    const count = await countQuery.getCount();
    let page = 1;
    let limit = 5;
    if(filters.page && Number(filters.page) > 1){
      page = Number(filters.page);
    }
    if(filters.limit && Number(filters.limit) >= 1){
      limit = Number(filters.limit);
    }
    let totalPages = Math.max(1, Math.ceil(count / limit));
    if(page > totalPages){
      page = totalPages
    }
    const skip = (page - 1) * limit;
    const productsData = await productQuery
      .offset(skip)
      .limit(limit)
      .getRawMany();
    const productResult = productsData.map(product =>{
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
  }catch(error){
    logger.error("取得商品列表錯誤:", error);
    next(error);
  }
})
router.get("/products/:productId", verifyToken, verifyAdmin, async (req, res, next) =>{
  try{
    const {productId} = req.params;
    if(!productId || isNotValidInteger(Number(productId)) || Number.isNaN(Number(productId))){
      res.status(400).json({
        status: false,
        message: "欄位資料格式不符"
      })
      return
    }
    const existProduct = await dataSource.getRepository("Products")
      .createQueryBuilder("products")
      .where("products.id =:productId", {productId: productId})
      .getExists();
    if(!existProduct){
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
      .where("products.id =:productId", {productId: productId})
      .getRawOne();
    const imageData = await dataSource.getRepository("ProductImages")
      .createQueryBuilder("image")
      .select([
        "image_url",
        "is_primary"
      ])
      .where("image.product_id =:productId", {productId: productId})
      .getRawMany();
    const imageResult = imageData.map(data =>{
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
  }catch(error){
    logger.error("取得商品詳細錯誤:", error);
    next(error);
  }
})
module.exports = router;
