const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Admin');
const {isNotValidString, isNotValidInteger, isValidDateStr, isValidEmail} = require("../utils/validUtils")
const {verifyToken, verifyAdmin} = require("../middlewares/auth")

function formatDateToYYYYMMDD(dateString){
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始，所以要 + 1，並補零
    const day = String(date.getDate()).padStart(2, "0"); // 補零
    return `${year}-${month}-${day}`;
}
router.get("/orders", verifyToken, verifyAdmin, async(req, res, next) =>{
    try{
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
        }
        const allowedOrderStatus = ["created", "pending", "shipped", "completed", "cancelled"];
        const allowedPaymentStatus = ["unpaid", "paid", "refunded"];
        const allowedShippingStatus = ["notReceived", "processing", "inTransit", "delivered", "returned"];
        const allowedSortBy = {
            createdAt: "created_at",
            finalAmount: "final_amount",
        }
        const allowedSortOrder = ["DESC", "ASC"]
        const filters = req.query;
        for(const key of Object.keys(filters)){
            if(!(key in allowedFilters)){
                res.status(400).json({
                    status: false,
                    message: "不支援的搜尋條件",
                })
                return
            }
            const exceptedType = allowedFilters[key];
            const value = filters[key];
            if(exceptedType === "number"){
                if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
            }
            if(exceptedType === "string"){
                if(!value || isNotValidString(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                //日期格式驗證
                if((key === "startDate" || key === "endDate") && !isValidDateStr(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                if(key === "orderStatus" && !allowedOrderStatus.includes(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                if(key === "paymentStatus" && !allowedPaymentStatus.includes(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                if(key === "shippingStatus" && !allowedShippingStatus.includes(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                if(key === "userEmail" && !isValidEmail(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
                if(key === "sortBy" && !(value in allowedSortBy)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符"
                    })
                    return
                }
                if(key === "sortOrder" && !(allowedSortOrder.includes(value.toUpperCase()))){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    })
                    return
                }
            }
        }
        let orderQuery = dataSource.getRepository("Orders")
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
            ])
        //起始日期 結束日期
        if(filters.startDate && filters.endDate){
            if(filters.startDate > filters.endDate){
                res.status(400).json({
                    status: false,
                    message: "欄位資料格式不符"
                })
                return
            }
            const start = new Date(filters.startDate + "T00:00:00.000")
            const end = new Date(filters.endDate + "T23:59:59.999")
            orderQuery = orderQuery
                .andWhere("orders.created_at BETWEEN :start AND :end", {start: start, end: end})
        }
        if(filters.startDate && !filters.endDate){
            const start = new Date(filters.startDate + "T00:00:00.000")
            orderQuery = orderQuery
                .andWhere("orders.created_at >=:start", {start: start})
        }
        if(!filters.startDate && filters.endDate){
            const end = new Date(filters.endDate + "T23:59:59.999")
            orderQuery = orderQuery
                .andWhere("orders.created_at <=:end", {end: end})
        }
        if(filters.orderStatus){
            orderQuery = orderQuery
                .andWhere("orders.order_status =:orderStatus", {orderStatus: filters.orderStatus})
        }
        if(filters.paymentStatus){
            orderQuery = orderQuery
                .andWhere("orders.payment_status =:paymentStatus", {paymentStatus: filters.paymentStatus})
        }
        if(filters.shippingStatus){
            orderQuery = orderQuery
                .andWhere("orders.shipping_status =:shippingStatus", {shippingStatus: filters.shippingStatus})
        }
        if(filters.userEmail){
            orderQuery = orderQuery
                .andWhere("user.email =:Email", {Email: filters.userEmail})
        }
        if(filters.orderNumber){
            orderQuery = orderQuery
                .andWhere("orders.order_number =:orderNumber", {orderNumber: filters.orderNumber})
        }
        //排序依據
        let sortBy = "created_at";
        let sortOrder = "DESC";
        if(filters.sortBy){
            sortBy = allowedSortBy[filters.sortBy]
        }
        if(filters.sortOrder){
            sortOrder = filters.sortOrder.toUpperCase();
        }
        orderQuery = orderQuery.orderBy(`orders.${sortBy}`, sortOrder)
        //總筆數
        const countQuery = orderQuery.clone();
        const count = await countQuery.getCount();
        //分頁
        let page = 1;
        let limit = 20;
        if(filters.page && Number(filters.page) > page){
            page = Number(filters.page);
        }
        if(filters.limit && Number(filters.limit) >= 1){
            limit = Number(filters.limit);
        }
        const totalPages = Math.max(1, Math.ceil(count / limit));
        if(page > totalPages){
            page = totalPages;
        }
        const skip = (page - 1) * limit;
        const ordersData = await orderQuery
            .offset(skip)
            .limit(limit)
            .getRawMany()
        const ordersResult = ordersData.map(order =>{
            return {
                orderNumber: order.order_number,
                userName: order.username,
                finalAmount: order.final_amount,
                orderStatus: order.order_status,
                paymentStatus: order.payment_status,
                shippingStatus: order.shipping_status,
                createdAt: formatDateToYYYYMMDD(order.created_at)
            }
        })
        res.status(200).json({
            status: true,
            data: {
                pagination: {
                    page: page,
                    limit: limit,
                    totalPages: totalPages,
                },
                orders: ordersResult
            }
        })
    }catch(error){
        logger.error('取得用戶訂單列表錯誤:', error);
        next(error);
    }
})

router.get("/orders/:orderNumber", verifyToken, verifyAdmin, async(req, res, next) =>{
    try{
        const {orderNumber} = req.params;
        if(!orderNumber || isNotValidString(orderNumber)){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            })
            return
        }
        const existOrder = await dataSource.getRepository("Orders").findOneBy({order_number: orderNumber});
        if(!existOrder){
            res.status(404).json({
                status: false,
                message: "找不到此訂單"
            })
            return
        }
        const orderData = await dataSource.getRepository("Orders")
            .createQueryBuilder("orders")
            .innerJoin("PaymentTransactions", "pt", "pt.merchant_order_no =:merchantOrderNo", {merchantOrderNo: orderNumber})
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
            .where("orders.order_number =:orderNumber", {orderNumber: orderNumber})
            .getRawOne();
        const orderItems = await dataSource.getRepository("OrderItems")
            .createQueryBuilder("orderItems")
            .select([
                "orderItems.product_title AS title",
                "orderItems.quantity AS quantity",
                "orderItems.price AS price",
                "orderItems.subtotal AS subtotal"
            ])
            .where("orderItems.order_id =:orderId", {orderId: orderData.id})
            .getRawMany()
        const itemsResult = orderItems.map(item =>{
            return {
                productTitle: item.title,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }
        })
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
                items: itemsResult
            }
        })
    }catch(error){
        logger.error('取得用戶訂單詳細錯誤:', error);
        next(error);
    }
})
//更新訂單狀態
router.post("/orders/:orderNumber/status", verifyToken, verifyAdmin, async(req, res, next) =>{
    try{
        const {orderNumber} = req.params;
        const {orderStatus, statusNote} = req.body;
        if(!orderNumber || isNotValidString(orderNumber) || !orderStatus || isNotValidString(orderStatus)){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            })
            return
        }
        if(statusNote && typeof statusNote !== "string"){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            })
            return
        }
        const existOrder = await dataSource.getRepository("Orders").findOneBy({order_number: orderNumber});
        if(!existOrder){
            res.status(404).json({
                status: false,
                message: "找不到該訂單"
            })
            return
        }
        if((orderStatus === "shipped" && existOrder.order_status === "pending" && existOrder.payment_status === "paid" && existOrder.shipping_status === "notReceived")
            || (orderStatus === "completed" && existOrder.order_status === "shipped" && existOrder.payment_status === "paid" && existOrder.shipping_status === "delivered")
            || (orderStatus === "cancelled" && existOrder.order_status === "pending" && existOrder.payment_status === "paid" && existOrder.shipping_status === "notReceived")
            || (orderStatus === "cancelled" && existOrder.order_status === "completed" && existOrder.payment_status === "paid" && existOrder.shipping_status === "returned")){
            const result = await dataSource.getRepository("Orders")
                .createQueryBuilder("orders")
                .update()
                .set({
                    order_status: orderStatus,
                    status_note: statusNote,
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .where("orders.order_number =:orderNumber", {orderNumber: orderNumber})
                .execute()
            if(result.affected !== 1){
                res.status(422).json({
                    status: false,
                    message: "訂單更新失敗"
                })
                return
            }
            res.status(200).json({
                status: true,
                message: "訂單狀態更新成功"
            })
        }else{
            res.status(400).json({
                status: false,
                message: "無效的訂單狀態或狀態轉換不被允許"
            })
        }
    }catch(error){
        logger.error('更新用戶訂單狀態錯誤:', error);
        next(error);
    }
})
module.exports = router;