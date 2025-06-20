const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Orders");
const { verifyToken } = require("../middlewares/auth");
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")
const {isUUID} = require("validator");

router.get("/", verifyToken, async(req, res, next) =>{
  try{
    const {id} = req.user;
    const filters = req.query;
    const allowedFilters = {
      page: "number",
      limit: "number",
    }
    let page = 1;
    let limit = 20;
    for(const key of Object.keys(filters)){
      if(!(key in allowedFilters)){
        res.status(400).json({
          status: false,
          message: "不支援的搜尋條件",
        });
        return
      }
      const value = filters[key];
      if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return
      }
      if(key === "page" && Number(value) > 1){
        page = Number(value);
      }
      if(key === "limit" && Number(value) >= 1){
        limit = Number(value);
      }
    }
    if(!id || isNotValidString(id) || !isUUID(id)){
      res.status(400).json({
        status: false,
        message: "欄位資料格式不符",
      });
      return
    }
    let ordersQuery =  dataSource.getRepository("Orders")
      .createQueryBuilder("orders")
      .innerJoin("OrderItems", "orderItems", "orderItems.order_id = orders.id")
      .select([
        "orders.id AS id",
        "orders.order_number AS order_number",
        "orders.payment_method AS payment_method",
        "orders.created_at AS created_at",
        "orders.shipped_at AS shipped_at",
        "orders.completed_at AS completed_at",
        "orders.return_at AS return_at",
        "orders.final_amount AS final_amount",
        "orders.order_status AS order_status",
        "orders.payment_status AS payment_status",
        "orders.shipping_status AS shipping_status",
        "orders.tracking_number AS tracking_number",
        "SUM(orderItems.quantity) AS total_quantity"
      ])
      .where("orders.user_id =:userId", {userId: id})
      .groupBy("orders.id")
      .orderBy("orders.created_at", "DESC")
    const countQuery = ordersQuery.clone(); 
    const count = await countQuery.getCount();
    const totalPages = Math.max(1, Math.ceil(count / limit));
    if(page > totalPages){
      page = totalPages
    }
    const skip = (page - 1) * limit;
    const ordersData = await ordersQuery
      .offset(skip)
      .limit(limit)
      .getRawMany();
    if(ordersData.length === 0){
      res.status(200).json({
        status: true,
        data: {
          pagination:{
            page: page,
            limit: limit,
            total: count,
            totalPages: totalPages,
          },
          orders: []
        }
      })
      return
    }
    const orderIds = ordersData.map(data => data.id);
    const transaction = await dataSource.getRepository("PaymentTransactions")
      .createQueryBuilder("transactions")
      .select([
        "order_id",
        "payment_time",
        "transaction_number"
      ])
      .where("transactions.order_id IN (:...ids)", {ids: orderIds})
      .getRawMany();
    const ordersResult = ordersData.map(order =>{
      const id = order.id;
      const result =transaction.find(item => item.order_id === id)
      return {
        orderNumber: order.order_number,
        createdAt: order.created_at,
        paymentMethod: order.payment_method,
        paidAt: result ? result.payment_time : null,
        shippedAt: order.shipped_at,
        completedAt: order.completed_at,
        returnAt: order.return_at,
        totalQuantity: parseInt(order.total_quantity),
        finalAmount: parseInt(order.final_amount),
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        shippingStatus: order.shipping_status,
        transactionNumber: result ? result.transaction_number : null,
        trackingNumber: order.tracking_number
      }
    })
    res.status(200).json({
      status: true,
      data: {
        pagination:{
          page: page,
          limit: limit,
          total: count,
          totalPages: totalPages,
        },
        orders: ordersResult
      }
    })
  }catch(error){
    logger.error('取得訂單列表錯誤:', error);
    next(error);
  }
})

router.get("/:orderNumber", verifyToken, async(req, res, next) =>{
  try{
    const {id} = req.user;
    const {orderNumber} = req.params;
    if(!id || isNotValidString(id) || !isUUID(id) || !orderNumber || isNotValidString(orderNumber)){
      res.status(400).json({
        status: false,
        message: "欄位資料格式不符"
      })
      return
    }
    const existOrder = await dataSource.getRepository("Orders").findOneBy({
      user_id: id,
      order_number: orderNumber
    });
    if(!existOrder){
      res.status(404).json({
        status: false,
        message: "找不到該訂單"
      })
      return
    }
    const items = await dataSource.getRepository("OrderItems")
      .createQueryBuilder("orderItems")
      .innerJoin("orderItems.Products", "products")
      .leftJoin("ProductImages", "image", "image.product_id = orderItems.product_id AND image.is_primary =:isPrimary", {isPrimary: true})
      .select([
        "orderItems.product_id AS id",
        "orderItems.product_title AS title",
        "products.author AS author",
        "orderItems.quantity AS quantity",
        "orderItems.subtotal AS subtotal",
        "image.image_url AS image_url"
      ])
      .where("orderItems.order_id =:orderId", {orderId: existOrder.id})
      .getRawMany();
    const itemsResult = items.map(item =>{
      return {
        productId: item.id,
        productTitle: item.title,
        author: item.author,
        quantity: item.quantity,
        itemAmount: parseInt(item.subtotal),
        imageUrl: item.image_url
      }
    })
    res.status(200).json({
      status: true,
      data: {
        totalAmount: parseInt(existOrder.total_amount),
        discountAmount: parseInt(existOrder.discount_amount),
        shippingFee: parseInt(existOrder.shipping_fee),
        finalAmount: parseInt(existOrder.final_amount),
        items: itemsResult
      }
    })
  }catch(error){
    logger.error('取得訂單詳細錯誤:', error);
    next(error);
  }
})
//請求變更訂單(取消訂單、退貨申請)
router.post("/action", verifyToken, async(req, res, next) =>{
  try{
    const {type} = req.query;
    const {orderNumber, returnReason} = req.body;
    const allowedTypes = ["cancel", "return"];
    if(!type || isNotValidString(type) || !orderNumber || isNotValidString(orderNumber)){
      res.status(400).json({
        status: false,
        message: "欄位資料格式不符"
      })
      return
    }
    if(!allowedTypes.includes(type)){
      res.status(400).json({
        status: false,
        message: "不允許的請求類型"
      })
      return
    }
    const existOrder = await dataSource.getRepository("Orders").findOneBy({order_number: orderNumber});
    if(!existOrder){
      res.status(404).json({
        status: false,
        message: "找不到該訂單",
      });
      return
    }
    //取消訂單
    if(type === "cancel"){
      //確認訂單狀態
      const pendingOrder = await dataSource.getRepository("Orders")
        .createQueryBuilder("orders")
        .where("order_number =:orderNumber", {orderNumber})
        .andWhere("order_status =:orderStatus", {orderStatus: "pending"})
        .andWhere("shipping_status =:shippingStatus", {shippingStatus: "notReceived"})
        .andWhere("payment_status =:paymentStatus", {paymentStatus: "paid"})
        .getOne();
      if(!pendingOrder){
        res.status(400).json({
            status: false,
            message: "無效的訂單狀態或狀態轉換不被允許",
        });
        return
      }
      const updateOrder = await dataSource.getRepository("Orders")
        .createQueryBuilder("orders")
        .update()
        .set({
            order_status: "cancelled",
            cancelled_at: new Date()
        })
        .where("order_number =:orderNumber", {orderNumber})
        .execute();
      if(updateOrder.affected === 0){
        logger.warn(`訂單編號 ${orderNumber} 取消訂單失敗`)
        res.status(422).json({
          status: false,
          message: ` ${orderNumber} 取消訂單失敗`,
        });
        return
      }
      res.status(200).json({
        status: true,
        message: `${orderNumber} 取消訂單成功`
      })
    }
    //申請退貨
    if(type === "return"){
      if(!returnReason || isNotValidString(returnReason)){
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符"
        })
        return
      }
      const completedOrder = await dataSource.getRepository("Orders")
        .createQueryBuilder("orders")
        .where("order_number =:orderNumber", {orderNumber})
        .andWhere("order_status =:orderStatus", {orderStatus: "completed"})
        .andWhere("shipping_status =:shippingStatus", {shippingStatus: "delivered"})
        .andWhere("payment_status =:paymentStatus", {paymentStatus: "paid"})
        .getOne();
      if(!completedOrder){
        res.status(400).json({
          status: false,
          message: "無效的訂單狀態或狀態轉換不被允許",
        });
        return
      }
      const completedDateTime = new Date(completedOrder.completed_at);
      const now = new Date();
      //7天內才可退貨
      if((now - completedDateTime)/86400000 > 7){
        res.status(400).json({
          status: false,
          message: "無效的訂單狀態或狀態轉換不被允許",
        });
        return
      }
      const updateOrder = await dataSource.getRepository("Orders")
        .createQueryBuilder("orders")
        .update()
        .set({
          order_status: "returnRequested",
          return_at: new Date(),
          return_reason: returnReason
        })
        .where("order_number =:orderNumber", {orderNumber})
        .execute();
      if(updateOrder.affected === 0){
        //訂單退貨申請失敗
        logger.warn(`訂單編號 ${orderNumber} 退貨申請失敗`)
        res.status(422).json({
          status: false,
          message: ` ${orderNumber} 退貨申請失敗`,
        });
        return
      }
      logger.info(`訂單編號 ${orderNumber} 退貨申請成功`)
      //發送退貨申請通知
      const message = await dataSource.getRepository("Tasks")
        .createQueryBuilder()
        .insert()
        .values({
          title: `退貨申請`,
          content: `提醒您，訂單編號 ${orderNumber} 提出退貨申請，請儘速審核，謝謝。`,
          type: "system",
          related_resource_type: "orders",
          related_resource_id: completedOrder.id
        })
        .execute();
      if(message.identifiers.length === 0){
        logger.warn(`訂單編號 ${orderNumber} 發送退貨申請審核通知失敗`)
      }else{
        logger.info(`訂單編號 ${orderNumber} 發送退貨申請審核通知成功`)
      }
      res.status(200).json({
        status: true,
        message: `訂單 ${orderNumber} 成功申請退貨`
      })
    }
  }catch(error){
    logger.error('請求變更訂單錯誤:', error);
    next(error);
  }
})

router.post(
  "/:orderNumber/products/:productId/reviews",
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.user;
      const { orderNumber, productId } = req.params;
      const { title, rating, content } = req.body;

      // 驗證路由參數
      if (!id || isNotValidString(id) || !isUUID(id)) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      if (!orderNumber || isNotValidString(orderNumber)) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      if (
        !productId ||
        isNotValidString(productId) ||
        isNotValidInteger(Number(productId)) ||
        Number.isNaN(Number(productId))
      ) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      // 驗證必填欄位
      if (
        !rating ||
        isNotValidInteger(Number(rating)) ||
        Number.isNaN(Number(rating))
      ) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      if (!content || isNotValidString(content)) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      // 驗證評分範圍
      const ratingNum = Number(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({
          status: false,
          message: "評分必須為 1-5 的整數",
        });
        return;
      }

      // 驗證評價內容長度
      const contentTrimmed = content.trim();
      if (contentTrimmed.length < 10 || contentTrimmed.length > 100) {
        res.status(400).json({
          status: false,
          message: "評價內容最少10字，最多100字",
        });
        return;
      }

      // 驗證 title 長度（如果有提供）
      if (title && (isNotValidString(title) || title.trim().length > 10)) {
        res.status(400).json({
          status: false,
          message: "欄位資料格式不符",
        });
        return;
      }

      // 檢查訂單是否存在且屬於該用戶
      const existOrder = await dataSource.getRepository("Orders").findOneBy({
        user_id: id,
        order_number: orderNumber,
      });

      if (!existOrder) {
        res.status(404).json({
          status: false,
          message: "找不到該訂單或商品",
        });
        return;
      }

      // 檢查該商品是否在該訂單中
      const orderItem = await dataSource.getRepository("OrderItems").findOneBy({
        order_id: existOrder.id,
        product_id: Number(productId),
      });

      if (!orderItem) {
        res.status(404).json({
          status: false,
          message: "找不到該訂單或商品",
        });
        return;
      }

      // 檢查是否已經評價過
      const existingReview = await dataSource
        .getRepository("ProductReviews")
        .findOneBy({
          order_item_id: orderItem.id,
        });

      if (existingReview) {
        res.status(403).json({
          status: false,
          message: "您已評價過此商品",
        });
        return;
      }

      // 檢查商品是否存在
      const product = await dataSource.getRepository("Products").findOneBy({
        id: Number(productId),
        is_visible: true,
      });

      if (!product) {
        res.status(404).json({
          status: false,
          message: "找不到該訂單或商品",
        });
        return;
      }

      // 開始評價作業
      await dataSource.transaction(async (transactionalEntityManager) => {
        // 新增評價
        await transactionalEntityManager
          .getRepository("ProductReviews")
          .insert({
            product_id: Number(productId),
            user_id: id,
            order_item_id: orderItem.id,
            rating: ratingNum,
            title: title && title.trim() ? title.trim() : "一般評價",
            content: contentTrimmed,
          });

        // 更新 OrderItem 的 is_reviewed 狀態
        await transactionalEntityManager
          .getRepository("OrderItems")
          .update({ id: orderItem.id }, { is_reviewed: true });
      });

      res.status(201).json({
        status: true,
        message: "評價新增成功",
      });
    } catch (error) {
      logger.error("新增商品評價錯誤:", error);
      next(error);
    }
  }
);
module.exports = router;
