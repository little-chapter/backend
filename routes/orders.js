const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Orders');
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
                    message: `不支援的搜尋條件：${key}`,
                });
                return
            }
            const value = filters[key];
            if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
                res.status(400).json({
                    status: false,
                    message: `欄位 ${key} 資料格式不符`,
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
                message: `欄位資料格式不符`,
            });
            return
        }
        const ordersQuery = await dataSource.getRepository("Orders")
            .createQueryBuilder("orders")
            .select([
                "orders.order_number AS order_number",
                "orders.created_at AS created_at",
                "orders.final_amount AS final_amount",
                "orders.order_status AS order_status",
                "orders.payment_status AS payment_status",
                "orders.shipping_status AS shipping_status",
            ])
            .where("orders.user_id =:userId", {userId: id})
            .orderBy("orders.created_at", "DESC")
        const countQuery = ordersQuery.clone(); 
        const count = await countQuery.getCount();
        const totalPages = Math.ceil(count / limit);
        if(page > totalPages){
            page = totalPages
        }
        const skip = (page - 1) * limit;
        const ordersData = await ordersQuery
            .skip(skip)
            .take(limit)
            .getRawMany()
        const ordersResult = ordersData.map(order =>{
            return {
                orderNumber: order.order_number,
                createdAt: order.created_at,
                finalAmount: order.final_amount,
                orderStatus: order.order_status,
                paymentStatus: order.payment_status,
                shippingStatus: order.shipping_status
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

module.exports = router;