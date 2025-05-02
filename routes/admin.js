const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Admin');
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")
const {verifyToken, verifyAdmin} = require("../middlewares/auth")

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
        const filters = req.query;
        console.log(new Date(filters.startDate).toISOString()) //new Date()會轉UTC 要.toISOString()回來比較
        // const { selectedDate } = req.body; // e.g. '2025-05-02'
        // ✅ 轉換為 Date 物件（選擇性，可直接用字串也行）
        // const dateObj = new Date(selectedDate); // 注意：這會自動轉為 UTC 時區
        // ✅ 把 Date 轉成 YYYY-MM-DD 格式，避免時區誤差
        // const dateStr = dateObj.toISOString().split('T')[0]; // '2025-05-02'
        for(const key of Object.keys(filters)){
            if(!(key in allowedFilters)){
                res.status(400).json({
                    status: false,
                    message: `不支援的搜尋條件：${key}`,
                })
                return
            }
            const exceptedType = allowedFilters[key];
            const value = filters[key];
            if(exceptedType === "number"){
                if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
                    res.status(400).json({
                        status: false,
                        message: `欄位 ${key} 資料格式不符`,
                    })
                    return
                }
            }
            if(exceptedType === "string"){
                if(!value || isNotValidString(value)){
                    res.status(400).json({
                        status: false,
                        message: `欄位 ${key} 資料格式不符`,
                    })
                    return
                }
            }
        }
        //撈取資料
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
        // '2021-01-01'
        //有起始無結束 無起始有結束
        // if(filters.startDate){}
        // if(filters.endDate){}
        const allowedOrderStatus = ["created", "pending", "shipped", "completed", "cancelled"];
        const allowedPaymentStatus = ["unpaid", "paid", "refunded"];
        const allowedShippingStatus = ["notReceived", "processing", "inTransit", "delivered", "returned"];
        //訂單狀態
        if(filters.orderStatus){
            if(!allowedOrderStatus.includes(filters.orderStatus)){
                res.status(400).json({
                    status: false,
                    message: `orderStatus 不支援的搜尋條件：${filters.orderStatus}`,
                });
                return
            }
            orderQuery = orderQuery
                .andWhere("orders.order_status =:orderStatus", {orderStatus: filters.orderStatus})
        }
        //付款狀態
        if(filters.paymentStatus){
            if(!allowedPaymentStatus.includes(filters.paymentStatus)){
                res.status(400).json({
                    status: false,
                    message: `paymentStatus 不支援的搜尋條件：${filters.paymentStatus}`,
                });
                return
            }
            orderQuery = orderQuery
                .andWhere("orders.payment_status =:paymentStatus", {paymentStatus: filters.paymentStatus})
        }
        //運送狀態
        if(filters.shippingStatus){
            if(!allowedShippingStatus.includes(filters.shippingStatus)){
                res.status(400).json({
                    status: false,
                    message: `shippingStatus 不支援的搜尋條件：${filters.shippingStatus}`,
                });
                return
            }
            orderQuery = orderQuery
                .andWhere("orders.shipping_status =:shippingStatus", {shippingStatus: filters.shippingStatus})
        }
        //使用者信箱
        if(filters.userEmail){
            const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if(!emailRegex.test(filters.userEmail)){
                res.status(400).json({
                    status: false,
                    message: `欄位 userEmail 資料格式不符`,
                })
                return
            }
            orderQuery = orderQuery
                .andWhere("user.email =:Email", {Email: filters.userEmail})
        }
        //訂單編號
        if(filters.orderNumber){
            orderQuery = orderQuery
                .andWhere("orders.order_number =:orderNumber", {orderNumber: filters.orderNumber})
        }
        //排序依據
        let sortBy = "created_at";
        let sortOrder = "DESC";
        const allowedSortOrder = {
            createdAt: "created_at",
            finalAmount: "final_amount",
        }
        if(filters.sortBy){
            const sortByStr = String(filters.sortBy);
            if(!(sortByStr in allowedSortOrder)){
                res.status(400).json({
                    status: false,
                    message: `sortBy 不支援的搜尋條件： ${sortByStr}`
                })
                return
            }
            sortBy = allowedSortOrder[sortByStr]
            //升降序
            if(filters.sortOrder){
                const order = String(filters.sortOrder).toUpperCase();
                if(!(order === "DESC" || order === "ASC")){
                    res.status(400).json({
                        status: false,
                        message: `欄位 sortOrder 資料格式不符`
                    })
                    return
                }
                sortOrder = order;
            }
        }else{
            if(filters.sortOrder){
                const order = String(filters.sortOrder).toUpperCase();
                if(!(order === "DESC" || order === "ASC")){
                    res.status(400).json({
                        status: false,
                        message: "欄位 sortOrder 資料格式不符"
                    })
                    return
                }
                sortOrder = order;
            }
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
            .skip(skip)
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
                createdAt: order.created_at
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