const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const { verifyToken } = require("../middlewares/auth");
const logger = require('../utils/logger')('Checkout');
const { isNotValidString, isNotValidInteger, isValidEmail } = require("../utils/validUtils");
const { isUUID } = require("validator");
const { addOneDayToUtc } = require("../utils/datetimeUtils");
const { generateTradeInfo } = require("../utils/generateTradeinfo");

router.post("/", verifyToken, async(req, res, next)=>{
    try{
        let {totalAmount, discountAmount, shippingFee, finalAmount, discountCode, items, paymentMethod, shippingMethod,
            recipientName, recipientEmail, recipientPhone, shippingAddress, invoiceType, carrierNum, note
        } = req.body;
        const {id, email} = req.user;
        if(!totalAmount || !finalAmount || !items || !paymentMethod || !shippingMethod || !recipientName
            || !recipientEmail || !recipientPhone || !shippingAddress || !invoiceType || !id || !email
        ){
            res.status(400).json({
                "status": false,
                "message": "必要欄位未填寫"
            })
            return
        }
        if(discountAmount){
            discountAmount = Number(discountAmount);
            if(typeof discountAmount !== "number" || discountAmount < 0 || Number.isNaN(discountAmount)){
                res.status(400).json({
                    "status": false,
                    "message": "欄位資料格式不符"
                })
                return
            }
        }else{
            discountAmount = 0;
        };
        if(shippingFee){
            shippingFee = Number(shippingFee);
            if(typeof shippingFee !== "number" || shippingFee < 0  || Number.isNaN(shippingFee)){
                res.status(400).json({
                    "status": false,
                    "message": "欄位資料格式不符"
                })
                return
            }
        }else{
            shippingFee = 0;
        };
        if(carrierNum){
            carrierNum = String(carrierNum);
            const carrierNumRegex = /^\/[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+\-\.]{7}$/;
            if(!carrierNumRegex.test(carrierNum)){
                res.status(400).json({
                    "status": false,
                    "message": "欄位資料格式不符"
                })
                return
            }
        }
        if(note){
            note = String(note);
            if(typeof note !== "string"){
                res.status(400).json({
                    "status": false,
                    "message": "欄位資料格式不符"
                })
                return
            }
        }else{
            note = "";
        }
        totalAmount = Number(totalAmount);
        finalAmount = Number(finalAmount);
        const phoneRegex = /^09\d{8}$/;
        const allowedPaymentMethod = ["WEBATM", "CREDIT"];
        const allowedShippingMethod = ["homeDelivery"];
        const allowedInvoiceType = ["e-invoice", "paper"];
        if(isNotValidInteger(totalAmount) || isNotValidInteger(finalAmount) || Number.isNaN(totalAmount) || Number.isNaN(finalAmount) || typeof items !== "object"
            || isNotValidString(paymentMethod) || !allowedPaymentMethod.includes(paymentMethod.toUpperCase()) || isNotValidString(shippingMethod) || !allowedShippingMethod.includes(shippingMethod)
            || isNotValidString(recipientName) || isNotValidString(recipientEmail) || !isValidEmail(recipientEmail) || isNotValidString(recipientPhone) || !phoneRegex.test(recipientPhone)
            || isNotValidString(shippingAddress) || isNotValidString(invoiceType) || !allowedInvoiceType.includes(invoiceType)
            || isNotValidString(id) || !isUUID(id) || isNotValidString(email) || !isValidEmail(email)
        ){
            res.status(400).json({
                "status": false,
                "message": "欄位資料格式不符"
            })
            return
        }
        if((totalAmount - discountAmount + shippingFee) !== finalAmount){
            res.status(400).json({
                "status": false,
                "message": "欄位資料格式不符"
            })
            return
        }
        if(items.length === 0){
            res.status(400).json({
                "status": false,
                "message": "購物車至少需要一項商品"
            })
            return
        }
        const existUser = await dataSource.getRepository("User")
            .createQueryBuilder("user")
            .where("user.id =:userId", {userId: id});
        if(!existUser){
            res.status(404).json({
                "status": false,
                "message": "此用戶不存在"
            })
            return
        }
        //折扣碼驗證
        if(discountCode){
            discountCode = String(discountCode).toUpperCase();
            if(isNotValidString(discountCode)){
                res.status(400).json({
                    "status": false,
                    "message": "欄位資料格式不符"
                })
                return
            }
            //折扣碼是否有效
            const now = new Date().toISOString();
            const existCode = await dataSource.getRepository("DiscountCodes")
                .createQueryBuilder("discountCodes")
                .where("discountCodes.code =:code", {code: discountCode})
                .andWhere("discountCodes.start_date <=:startDate", {startDate: now})
                .andWhere("discountCodes.end_date >:endDate", {endDate: now})
                .andWhere("discountCodes.is_active =:isActive", {isActive: true})
                .getOne();
            if(!existCode || existCode.min_purchase > totalAmount){
                res.status(400).json({
                    "status": false,
                    "message": "折扣碼無效"
                })
                return
            }
            //用戶是否使用過折扣碼
            const existUsage = await dataSource.getRepository("DiscountCodeUsages")
                .createQueryBuilder("codeUsages")
                .where("codeUsages.code_id =:codeId", {codeId: existCode.id})
                .andWhere("codeUsages.user_id =:userId", {userId: id})
                .getOne();
            if(existUsage){
                res.status(409).json({
                    "status": false,
                    "message": "已使用過此折扣碼"
                })
                return
            }
        }
        //欲購買商品是否存在
        const itemsIds = items.map(item =>{
            return item.productId
        })
        const existProducts = await dataSource.getRepository("Products")
            .createQueryBuilder("product")
            .select([
                "product.id AS id",
                "product.title AS title",
                "product.stock_quantity AS stock"
            ])
            .where("product.id IN (:...ids)", {ids: itemsIds})
            .getRawMany();
        const productIds = existProducts.map(product =>{ //資料庫商品ids
            return product.id
        })
        const missingIds = itemsIds.filter(itemId =>{ //檢查不存在的商品
            return !productIds.includes(itemId)
        })
        if(missingIds.length !== 0){
            res.status(404).json({
                "status": false,
                "message": "部分商品不存在"
            })
            return
        }
        //欲購買商品庫存是否足夠
        const outOfStock = [];
        items.forEach(item =>{
            const productId = item.productId;
            const requestedQTY = item.quantity;
            existProducts.forEach(product =>{
                if(product.id === productId && product.stock < requestedQTY){
                    product.requestedQuantity = requestedQTY;
                    outOfStock.push(product)
                }
            })
        })
        if(outOfStock.length !== 0){
            const outOfStockResult = outOfStock.map(item =>{
                return {
                    productId: item.id,
                    productTitle: item.title,
                    requestedQuantity: item.requestedQuantity,
                    availableQuantity: item.stock
                }
            })
            res.status(409).json({
                "status": false,
                "message": "部分商品庫存不足",
                "errors": outOfStockResult
            })
            return
        }
        const nowUTCStr = new Date().toISOString();
        const randomThreeDigits = Math.floor(Math.random() * 1000).toString().padStart(3, "0"); //隨機三碼
        const orderNumber = `ORD${Math.floor(Date.now()/1000)}${randomThreeDigits}`; //建立訂單編號
        const code = await dataSource.getRepository("DiscountCodes")
            .createQueryBuilder("discountCodes")
            .select(["discountCodes.id AS id"])
            .where("discountCodes.code =:code", {code: discountCode})
            .getRawOne();
        await dataSource.transaction(async (transactionalEntityManager) => {
            //暫存訂單
            const pendingOrder = await transactionalEntityManager
                .createQueryBuilder()
                .insert()
                .into("PendingOrders")
                .values({
                    user_id: id,
                    order_number: orderNumber,
                    status: "pending",
                    total_amount: totalAmount,
                    shipping_fee: shippingFee,
                    discount_amount: discountAmount,
                    final_amount: finalAmount,
                    recipient_name: recipientName,
                    recipient_email: recipientEmail,
                    recipient_phone: recipientPhone,
                    invoice_type: invoiceType,
                    carrier_number: carrierNum, 
                    shipping_method: shippingMethod,
                    shipping_address: shippingAddress,
                    payment_method: paymentMethod,
                    note: note,
                    discount_code: code ? code.id : null,
                    expired_at: addOneDayToUtc(nowUTCStr),
                })
                .execute();
            if(pendingOrder.identifiers.length === 0){
                logger.warn("新增暫存訂單失敗");
                console.log("新增暫存訂單失敗")
                return
            }
            const pendingOrderId = pendingOrder.identifiers[0].id;
            //暫存訂單商品關聯
            const pendingOrderItem = items.map((item, index) =>{
                existProducts.forEach(product =>{
                    if(product.id === item.productId){
                        items[index].title = product.title;
                    }
                })
                return {
                    pending_order_id: pendingOrderId,
                    product_id: item.productId,
                    product_title: item.title,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.price * item.quantity,
                    expired_at: addOneDayToUtc(nowUTCStr)
                }
            })
            const orderItemResult = await transactionalEntityManager
                .createQueryBuilder()
                .insert()
                .into("PendingOrderItems")
                .values(pendingOrderItem)
                .execute();
            if(orderItemResult.identifiers.length === 0){
                logger.warn("新增暫存訂單商品關聯失敗");
                console.log("新增暫存訂單商品關聯失敗")
                return
            }
        })
        const order = generateTradeInfo(finalAmount, email, orderNumber);
        res.status(200).json({
            status: true,
            message: "轉向第三方金流處理付款",
            data: order
        })
    }catch(error){
        logger.error('付款結帳錯誤:', error);
        next(error);
    }
})

module.exports = router;