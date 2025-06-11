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
                "orders.created_at AS created_at",
                "orders.shipped_at AS shipped_at",
                "orders.completed_at AS completed_at",
                "orders.return_at AS return_at",
                "orders.final_amount AS final_amount",
                "orders.order_status AS order_status",
                "orders.payment_status AS payment_status",
                "orders.shipping_status AS shipping_status",
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
        const orderIds = ordersData.map(data => data.id);
        const transaction = await dataSource.getRepository("PaymentTransactions")
            .createQueryBuilder("transactions")
            .select([
                "order_id",
                "payment_time"
            ])
            .where("transactions.order_id IN (:...ids)", {ids: orderIds})
            .getRawMany();
        const ordersResult = ordersData.map(order =>{
            const id = order.id;
            const result =transaction.find(item => item.order_id = id)
            return {
                orderNumber: order.order_number,
                createdAt: order.created_at,
                paidAt: result.payment_time,
                shippedAt: order.shipped_at,
                completedAt: order.completed_at,
                returnAt: order.return_at,
                totalQuantity: parseInt(order.total_quantity),
                finalAmount: parseInt(order.final_amount),
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

router.get("/:orderNumber", verifyToken, async(req, res, next) =>{
    try{
        const {id} = req.user;
        const {orderNumber} = req.params;
        if(!id || isNotValidString(id) || !isUUID(id) || !orderNumber || isNotValidString(orderNumber)){
            res.status(400).json({
                status: true,
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
                status: true,
                message: "找不到該訂單"
            })
            return
        }
        const items = await dataSource.getRepository("OrderItems")
            .createQueryBuilder("orderItems")
            .innerJoin("orderItems.Products", "products")
            .leftJoin("ProductImages", "image", "image.product_id = orderItems.product_id")
            .select([
                "orderItems.product_id AS id",
                "orderItems.product_title AS title",
                "products.author AS author",
                "orderItems.quantity AS quantity",
                "orderItems.subtotal AS subtotal",
                "image.image_url AS image_url"
            ])
            .where("orderItems.order_id =:orderId", {orderId: existOrder.id})
            .andWhere("image.is_primary =:isPrimary", {isPrimary: true})
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

module.exports = router;