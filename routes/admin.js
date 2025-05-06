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
        const totalPages = Math.ceil(count / limit);
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

module.exports = router;