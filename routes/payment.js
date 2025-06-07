const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Payment');
const { decryptAES, sha256 } = require("../utils/encryptUtils");
const { convertUtcToTaipei } = require("../utils/datetimeUtils");
const { generateEzpay } = require("../utils/generateEzpay");
const { sendOrderConfirmationEmail } = require("../utils/mailer");

const { 
    NEWEPAY_HASHKEY, 
    NEWEPAY_HASHIV,
    FRONTEND_URL,
    EZPAY_API_URL
} = process.env;

router.post("/return", async(req, res, next) =>{
    try{
        const raw = req.body.TradeInfo;
        const decrypted = decryptAES(raw, NEWEPAY_HASHKEY, NEWEPAY_HASHIV);
        const result = decrypted.Result;
        let targetUrl;
        if(decrypted.Status === "SUCCESS"){
            targetUrl = `${FRONTEND_URL}/cart/result/${result.MerchantOrderNo}/success?orderNum=${result.MerchantOrderNo}&serialNum=${result.TradeNo}&price=${result.Amt}&type=${result.PaymentType}`;
        }else{
            targetUrl = `${FRONTEND_URL}/cart/result/${result.MerchantOrderNo}/fail?orderNum=${result.MerchantOrderNo}&serialNum=${result.TradeNo}&price=${result.Amt}&type=${result.PaymentType}`;
        }
        res.send(`
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>跳轉中...</title>
                </head>
                <body>
                    <script>
                        window.location.replace("${targetUrl}");
                    </script>
                    <p>付款結果已確認，正在導回結果頁...</p>
                </body>
            </html>
        `);
    }catch(error){
        logger.error('金流前台回傳錯誤:', error);
        next(error);
    }
})
//金流背景通知
router.post("/notify", async(req, res, next) =>{
    try{
        const raw = req.body.TradeInfo;
        const resSHA = sha256(`HashKey=${NEWEPAY_HASHKEY}&${raw}&HashIV=${NEWEPAY_HASHIV}`).toUpperCase();
        if(resSHA !== req.body.TradeSha){
            logger.warn("回傳TradeSha錯誤");
            return
        }
        const decrypted = decryptAES(raw, NEWEPAY_HASHKEY, NEWEPAY_HASHIV);
        const result = decrypted.Result; //回傳細節
        const payTime = result.PayTime; //交易時間
        const orderNumber = result.MerchantOrderNo; //訂單編號
        if(decrypted.Status !== "SUCCESS"){
            //建立交易失敗Transaction
            await dataSource.getRepository("PaymentTransactions")
                .createQueryBuilder()
                .insert()
                .values({
                    merchant_order_no: orderNumber,
                    transaction_number: result.TradeNo,
                    payment_type: result.PaymentType,
                    amount: result.Amt,
                    status: decrypted.Status,
                    payment_time: new Date(payTime.slice(0, 10) + " " + payTime.slice(10) + "+0800"),
                    bank_code: result.PayBankCode || null,
                    payer_account5code: result.PayerAccount5Code || null,
                    account_number: result.AccountNumber || null,
                    barcode_1: result.Barcode_1 || null,
                    barcode_2: result.Barcode_2 || null,
                    barcode_3: result.Barcode_3 || null,
                    auth_code: result.Auth || null,
                    card_start6: result.Card6No || null,
                    card_last4: result.Card4No || null,
                    respond_code: result.RespondCode || null,
                    failed_message: decrypted.Message,
                    raw_response: JSON.stringify(decrypted)
                })
                .execute();
            logger.warn(`訂單編號 ${orderNumber} 交易失敗 ${decrypted.Status} : ${decrypted.Message}`)
        }else{
            const now = new Date().toISOString();
            const pendingOrder = await dataSource.getRepository("PendingOrders")
                .createQueryBuilder("pendingOrders")
                .where("pendingOrders.order_number =:orderNumber", {orderNumber: orderNumber})
                .andWhere("pendingOrders.status =:status", {status: "pending"})
                .andWhere("pendingOrders.expired_at >=:expiredAt", {expiredAt: now})
                .getOne();
            if(!pendingOrder || Number(result.Amt) !== Number(pendingOrder.final_amount)){
                logger.warn(`暫存訂單編號 ${orderNumber} 不存在或交易金額與訂單總金額不符`)
                return
            }
            logger.info(`訂單編號 ${orderNumber} 交易成功`)
            const pendingOrderId = pendingOrder.id;
            const pendingOrderItems = await dataSource.getRepository("PendingOrderItems").find({
                where: {
                    pending_order_id: pendingOrderId
                }
            });
            await dataSource.transaction(async(transactionalEntityManager) => {
                const userId = pendingOrder.user_id;
                //建立正式訂單
                const newOrder = await transactionalEntityManager
                    .createQueryBuilder()
                    .insert()
                    .into("Orders")
                    .values({
                        user_id: userId,
                        order_number: orderNumber,
                        order_status: "pending",
                        total_amount: parseInt(pendingOrder.total_amount),
                        shipping_fee: parseInt(pendingOrder.shipping_fee),
                        discount_amount: parseInt(pendingOrder.discount_amount),
                        final_amount: parseInt(pendingOrder.final_amount),
                        recipient_name: pendingOrder.recipient_name,
                        recipient_email: pendingOrder.recipient_email,
                        recipient_phone: pendingOrder.recipient_phone,
                        invoice_type: pendingOrder.invoice_type,
                        carrier_number: pendingOrder.carrier_number,
                        shipping_status: "notReceived",
                        shipping_method: pendingOrder.shipping_method,
                        shipping_address: pendingOrder.shipping_address,
                        store_code: pendingOrder.store_code,
                        store_name: pendingOrder.store_name,
                        payment_method: result.PaymentType,
                        payment_status: "paid",
                        note: pendingOrder.note
                    })
                    .execute();
                if(newOrder.identifiers.length === 0){
                    logger.warn(`建立正式訂單項目失敗`)
                    return
                }
                const newOrderId = newOrder.identifiers[0].id;
                logger.info(`已建立正式訂單ID: ${newOrderId}`)
                for(const item of pendingOrderItems){
                    const newOrderItem = await transactionalEntityManager
                        .createQueryBuilder()
                        .insert()
                        .into("OrderItems")
                        .values({
                            order_id: newOrderId,
                            product_id: item.product_id,
                            product_title: item.product_title,
                            quantity: parseInt(item.quantity),
                            price: parseInt(item.price),
                            subtotal: parseInt(item.subtotal)
                        })
                        .execute();
                    if(newOrderItem.identifiers.length === 0){
                        logger.warn(`建立正式訂單項目失敗`)
                        return
                    }
                    logger.info(`已建立正式訂單項目ID: ${newOrderItem.identifiers[0].id}`)
                }
                //建立交易資料
                const newTransaction = await transactionalEntityManager
                    .createQueryBuilder()
                    .insert()
                    .into("PaymentTransactions")
                    .values({
                        order_id: newOrderId,
                        merchant_order_no: orderNumber,
                        transaction_number: result.TradeNo,
                        payment_type: result.PaymentType,
                        amount: result.Amt,
                        status: decrypted.Status,
                        payment_time: new Date(payTime.slice(0, 10) + " " + payTime.slice(10) + "+0800"),
                        bank_code: result.PayBankCode || null,
                        payer_account5code: result.PayerAccount5Code || null,
                        account_number: result.AccountNumber || null,
                        barcode_1: result.Barcode_1 || null,
                        barcode_2: result.Barcode_2 || null,
                        barcode_3: result.Barcode_3 || null,
                        auth_code: result.Auth || null,
                        card_start6: result.Card6No || null,
                        card_last4: result.Card4No || null,
                        respond_code: result.RespondCode || null,
                        raw_response: JSON.stringify(decrypted)
                    })
                    .execute();
                if(newTransaction.identifiers.length === 0){
                    logger.warn(`建立交易資料失敗`)
                    return
                }
                logger.info(`已建立交易資料ID: ${newTransaction.identifiers[0].id}`)
                //刪除購物車項目
                const deleteCart = await transactionalEntityManager
                    .createQueryBuilder()
                    .delete()
                    .from("CartItems")
                    .where({user_id: userId})
                    .execute();
                logger.info(`已刪除購物車項目筆數: ${deleteCart.affected}`)
                //刪除暫存訂單、暫存訂單項目
                const deletePendingOrder = await transactionalEntityManager
                    .createQueryBuilder()
                    .delete()
                    .from("PendingOrders")
                    .where({id: pendingOrderId})
                    .execute();
                if(deletePendingOrder.affected === 0){
                    logger.warn(`刪除暫存訂單失敗、暫存訂單項目`)
                    return
                }
                logger.info(`已刪除暫存訂單筆數: ${deletePendingOrder.affected}`)
                //更新商品庫存
                for(const item of pendingOrderItems){
                    const updateProduct = await transactionalEntityManager
                        .createQueryBuilder()
                        .update("Products")
                        .set({
                            stock_quantity: ()=> `GREATEST(stock_quantity - ${item.quantity}, 0)`,
                            updated_at: new Date().toISOString()
                        })
                        .where("Products.id =:productId", {productId: item.product_id})
                        .execute();
                    if(updateProduct.affected === 0){
                        logger.warn(`商品編號 ${item.product_id} 庫存更新失敗`)
                    }else{
                        logger.info(`已更新商品編號 ${item.product_id} 庫存`)
                    }
                    //確認庫存
                    const productStock = await transactionalEntityManager
                        .getRepository("Products")
                        .findOne({
                            select: [
                                "id",
                                "title",
                                "stock_quantity"
                            ],where: {
                                id: item.product_id
                            }
                        })
                    //建立補貨任務
                    if(productStock.stock_quantity === 0){
                        const newTask = await transactionalEntityManager
                            .createQueryBuilder()
                            .insert()
                            .into("Tasks")
                            .values({
                                title: "庫存警示",
                                content: `提醒您，編號 ${productStock.id} 之《${productStock.title}》商品已無庫存，請儘速處理以免影響銷售，謝謝。`,
                                type: "restock",
                                related_resource_type: "products",
                                related_resource_id: item.product_id
                            })
                            .execute();
                        if(newTask.identifiers.length === 0){
                            logger.warn(`發送商品編號 ${productStock.id} 庫存不足通知失敗`)
                        }else{
                            logger.info(`已發送庫存不足通知之商品編號: ${productStock.id}`)
                        }
                    }
                }
                if(pendingOrder.discount_code){
                    const codeId = pendingOrder.discount_code;
                    //更新折扣碼使用次數
                    const updateCode = await transactionalEntityManager
                        .createQueryBuilder()
                        .update("DiscountCodes")
                        .set({
                            used_count: () => "used_count + 1"
                        })
                        .where({id: codeId})
                        .execute();
                    if(updateCode.affected === 0){
                        logger.warn(`折扣碼編號 ${codeId} 更新使用次數失敗`)
                    }else{
                        logger.info(`折扣碼編號 ${codeId} 更新使用次數成功`)
                    }
                    //建立使用折扣碼資料
                    const codeUsage = await transactionalEntityManager
                        .createQueryBuilder()
                        .insert()
                        .into("DiscountCodeUsages")
                        .values({
                            code_id: codeId,
                            order_id: newOrderId,
                            user_id: userId,
                            discount_amount: parseInt(pendingOrder.discount_amount)
                        })
                        .execute();
                    if(codeUsage.identifiers.length === 0){
                        logger.warn(`用戶 ${userId} 建立折扣碼使用紀錄失敗`)
                    }else{
                        logger.info(`用戶 ${userId} 建立折扣碼使用紀錄ID: ${codeUsage.identifiers[0].id}`)
                    }
                }
            })
            const officialOrder = await dataSource.getRepository("Orders")
                .createQueryBuilder("orders")
                .innerJoin("PaymentTransactions", "transaction", "transaction.order_id = orders.id")
                .innerJoin("orders.User", "user")
                .select([
                    "orders.id AS id",
                    "orders.order_number AS order_number",
                    "orders.order_status AS order_status",
                    "orders.payment_status AS payment_status",
                    "orders.shipping_status AS shipping_status",
                    "orders.created_at AS created_at",
                    "user.email AS email",
                    "user.name AS username",
                    "transaction.payment_time AS payment_time",
                    "transaction.amount AS amount",
                    "orders.payment_method AS payment_method",
                    "orders.invoice_type AS invoice_type",
                    "orders.carrier_number AS carrier_number",
                    "orders.shipping_method AS shipping_method",
                    "orders.recipient_name AS recipient_name",
                    "orders.recipient_email AS recipient_email",
                    "orders.recipient_phone AS recipient_phone",
                    "orders.shipping_address AS shipping_address",
                    "orders.note AS note",
                    "orders.total_amount AS total_amount",
                    "orders.discount_amount AS discount_amount",
                    "orders.shipping_fee AS shipping_fee",
                    "orders.final_amount AS final_amount",
                ])
                .where("orders.order_number =:orderNumber", {orderNumber: orderNumber})
                .getRawOne();
            const orderResult = {
                id: officialOrder.id,
                orderNumber: officialOrder.order_number,
                orderStatus: officialOrder.order_status,
                paymentStatus: officialOrder.payment_status,
                shippingStatus: officialOrder.shipping_status,
                createdAt: officialOrder.created_at,
                email: officialOrder.email,
                username: officialOrder.username,
                paymentTime: officialOrder.payment_time,
                amount: officialOrder.amount,
                paymentMethod: officialOrder.payment_method,
                invoiceType: officialOrder.invoice_type,
                carrierNumber: officialOrder.carrier_number,
                shippingMethod: officialOrder.shipping_method,
                recipientName: officialOrder.recipient_name,
                recipientEmail: officialOrder.recipient_email,
                recipientPhone: officialOrder.recipient_phone,
                shippingAddress: officialOrder.shipping_address,
                note: officialOrder.note,
                totalAmount: officialOrder.total_amount,
                discountAmount: officialOrder.discount_amount,
                shippingFee: officialOrder.shipping_fee,
                finalAmount: officialOrder.final_amount,
            }
            const officialOrderItems = await dataSource.getRepository("OrderItems").find({
                where: {
                    order_id: orderResult.id
                }
            });
            const itemsResult = officialOrderItems.map(item => ({
                title: item.product_title,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }))
            //發票開立
            const invoiceData = generateEzpay(orderResult, itemsResult);
            const formData = new URLSearchParams(invoiceData).toString();
            const response = await fetch(EZPAY_API_URL, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger.warn(`EZPAY API error: ${response.status} - ${errorText}`)
            }
            const ezpayReturn = await response.json();
            const status = ezpayReturn.Status;
            if(status === "SUCCESS"){ //成功開立 或重複開立
                const invoiceResult = JSON.parse(ezpayReturn.Result);
                const existInvoice = await dataSource.getRepository("Invoices").findOne({
                    where: {
                        merchant_order_no: invoiceResult.MerchantOrderNo,
                        status: "SUCCESS"
                    }
                });
                if(existInvoice){
                    logger.info(`訂單編號 ${invoiceResult.MerchantOrderNo} 已開立過發票: ${existInvoice.invoice_number}`)
                }else{
                    const newInvoice = await dataSource.getRepository("Invoices")
                        .createQueryBuilder("invoices")
                        .insert()
                        .values({
                            order_id: orderResult.id,
                            merchant_order_no: invoiceResult.MerchantOrderNo,
                            invoice_number: invoiceResult.InvoiceNumber,
                            total_amount: parseInt(invoiceResult.TotalAmt),
                            invoice_trans_no: invoiceResult.InvoiceTransNo,
                            random_number: invoiceResult.RandomNum,
                            barcode: invoiceResult.BarCode || null,
                            qrcode_l: invoiceResult.QRcodeL || null,
                            qrcode_r: invoiceResult.QRcodeR || null,
                            check_code: invoiceResult.CheckCode,
                            status: status,
                            create_time: invoiceResult.CreateTime + "+0800"
                        })
                        .execute();
                    if(newInvoice.identifiers.length === 0){
                        logger.warn(`訂單編號 ${invoiceResult.MerchantOrderNo} 發票建立失敗`)
                    }else{
                        logger.info(`訂單編號 ${invoiceResult.MerchantOrderNo} 發票建立成功`)
                    }
                }
            }else{
                //建立開立發票錯誤
                await dataSource.getRepository("Invoices")
                    .createQueryBuilder("invoices")
                    .insert()
                    .values({
                        order_id: orderResult.id,
                        merchant_order_no: orderResult.orderNumber,
                        total_amount: parseInt(orderResult.finalAmount),
                        status: status,
                        failed_message: ezpayReturn.Message,
                        create_time: new Date().toISOString()
                    })
                    .execute();
                logger.warn(`訂單編號 ${orderResult.orderNumber} 發票開立錯誤 ${status}: ${ezpayReturn.Message}`)
            }
            //寄送訂單成立信件
            const orderStatusList = {
                created: "已建立",
                pending: "待出貨",
                shipped: "已出貨",
                completed: "已完成",
                cancelled: "已取消"
            };
            const paymentStatusList = {
                unpaid: "未付款",
                paid: "已付款",
                refunded: "已退款"
            };
            const shippingStatusList = {
                notReceived: "尚未收貨",
                processing: "處理中",
                inTransit: "運送中",
                delivered: "已到貨",
                returned: "已退貨"
            };
            const paymentMethodList = {
                WEBATM: "WebATM",
                CREDIT: "信用卡"
            };
            const shippingMethodList = {
                homeDelivery: "宅配"
            };
            const invoiceTypeList = {
                "e-invoice": "電子發票",
                paper: "紙本發票(隨商品寄出)"
            };
            const orderPayload = {
                orderNumber: orderResult.orderNumber,
                orderStaus: orderStatusList[orderResult.orderStatus],
                paymentStaus: paymentStatusList[orderResult.paymentStatus],
                shippingStaus: shippingStatusList[orderResult.shippingStatus],
                createdAt: convertUtcToTaipei(orderResult.createdAt),
                userName: orderResult.username || orderResult.email,
                payTime: convertUtcToTaipei(orderResult.paymentTime),
                amount: parseInt(orderResult.amount),
                paymentMethod: paymentMethodList[orderResult.paymentMethod],
                invoiceType: invoiceTypeList[orderResult.invoiceType],
                shippingMethod: shippingMethodList[orderResult.shippingMethod],
                recipientName: orderResult.recipientName,
                recipientEmail: orderResult.recipientEmail,
                recipientPhone: orderResult.recipientPhone,
                shippingAddress: orderResult.shippingAddress,
                note: orderResult.note || "未填寫",
                totalAmount: parseInt(orderResult.totalAmount),
                discountAmount: parseInt(orderResult.discountAmount),
                shippingFee: parseInt(orderResult.shippingFee),
                finalAmount: parseInt(orderResult.finalAmount)
            };
            let officalItemsStr = "";
            itemsResult.forEach(item =>{
                officalItemsStr += `<tr>
                    <td>${item.title}</td>
                    <td>NT$ ${parseInt(item.price)}</td>
                    <td>${item.quantity}</td>
                    <td>NT$ ${parseInt(item.subtotal)}</td>
                </tr>`;
            })
            const emailSent = await sendOrderConfirmationEmail(orderResult.email, orderPayload, officalItemsStr);
            if(emailSent === true){
                logger.info(`訂單編號 ${orderPayload.orderNumber} 訂單成立信件寄送成功`)
            }else{
                logger.warn(`訂單編號 ${orderPayload.orderNumber} 訂單成立信件寄送失敗`)
            }
            res.send('|1|OK|');
        }
    }catch(error){
        logger.error('金流背景回傳錯誤:', error);
        next(error);
    }
})

module.exports = router;