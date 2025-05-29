const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Payment');
const { isNotValidString, isNotValidInteger, isValidEmail } = require("../utils/validUtils");
const { decryptAES, sha256 } = require("../utils/encryptUtils");
const { convertUtcToTaipei } = require("../utils/datetimeUtils");
const { generateEzpay } = require("../utils/generateEzpay");

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
        console.log('解密Return:', decrypted);
        if(decrypted.Status === "SUCCESS"){
            res.redirect(`${FRONTEND_URL}/cart/result/${result.MerchantOrderNo}/success?orderNum=${result.MerchantOrderNo}?serialNum=${result.TradeNo}?price=${result.Amt}?type=${result.PaymentType}`);
        }else{
            res.redirect(`${FRONTEND_URL}/cart/result/${result.MerchantOrderNo}/fail?orderNum=${result.MerchantOrderNo}?serialNum=${result.TradeNo}?price=${result.Amt}?type=${result.PaymentType}`);
        }
    }catch(error){
        logger.error('金流前台回傳錯誤:', error);
        next(error);
    }
})
//金流背景通知
router.post("/notify", async(req, res, next) =>{
    try{
        const raw = req.body.TradeInfo;
        if(!raw){
            logger.warn("交易資料不完全");
            console.log("交易資料不完全");
            return
        }
        // 再次 SHA 加密TradeInfo，確保兩個Sha比對一致（避免不正確的請求觸發交易成功）
        const resSHA = sha256(`HashKey=${NEWEPAY_HASHKEY}&${raw}&HashIV=${NEWEPAY_HASHIV}`).toUpperCase();
        console.log('resSHA:',resSHA)
        if(resSHA !== req.body.TradeSha){
            logger.warn("回傳TradeSha錯誤");
            console.log("回傳TradeSha錯誤");
            return
        }
        const decrypted = decryptAES(raw, NEWEPAY_HASHKEY, NEWEPAY_HASHIV);
        console.log("解密Return:", decrypted);
        //非成功交易
        if(decrypted.Status !== "SUCCESS"){
            logger.warn(decrypted.Status);
            console.log(decrypted.Status);
            return
        }
        const result = decrypted.Result;
        //取得暫存訂單
        const now = new Date().toISOString();
        const existPendingOrder = await dataSource.getRepository("PendingOrders")
            .createQueryBuilder("pendingOrders")
            .where("pendingOrders.order_number =:orderNumber", {orderNumber: result.MerchantOrderNo})
            .andWhere("pendingOrders.status =:status", {status: "pending"})
            .andWhere("pendingOrders.expired_at >=:expiredAt", {expiredAt: now})
            .getRawOne();
        console.log("暫存訂單:", existPendingOrder)
        if(!existPendingOrder){
            logger.warn("此訂單編號不存在暫存訂單");
            console.log("此訂單編號不存在暫存訂單");
            return
        }
        if(Number(result.Amt) !== Number(existPendingOrder.final_amount)){
            logger.warn("交易金額與暫存總金額不符");
            console.log("交易金額與暫存總金額不符");
            return
        }
        //取得暫存訂單項目
        const pendingOrderItems = await dataSource.getRepository("PendingOrderItems").findOneBy({pending_order_id: existPendingOrder.id});
        console.log("暫存訂單項目:", pendingOrderItems)
        if(!pendingOrderItems){
            logger.warn("此訂單編號無暫存商品");
            console.log("此訂單編號無暫存商品");
            return
        }
        await dataSource.transaction(async(transactionalEntityManager) => {
            //新增正式訂單
            const newOrder = await transactionalEntityManager
                .createQueryBuilder()
                .insert()
                .into("Orders")
                .values({
                    user_id: existPendingOrder.user_id,
                    order_number: existPendingOrder.order_number,
                    order_status: "pending",
                    total_amount: parseInt(existPendingOrder.total_amount),
                    shipping_fee: parseInt(existPendingOrder.shipping_fee),
                    discount_amount: parseInt(existPendingOrder.discount_amount),
                    final_amount: parseInt(existPendingOrder.final_amount),
                    recipient_name: existPendingOrder.recipient_name,
                    recipient_email: existPendingOrder.recipient_email,
                    recipient_phone: existPendingOrder.recipient_phone,
                    invoice_type: existPendingOrder.invoice_type,
                    carrier_number: existPendingOrder.carrier_number,
                    shipping_status: "notReceived",
                    shipping_method: existPendingOrder.shipping_method,
                    shipping_address: existPendingOrder.shipping_address,
                    store_code: existPendingOrder.store_code,
                    store_name: existPendingOrder.store_name,
                    payment_method: result.PaymentType,
                    payment_status: "paid",
                    note: existPendingOrder.note,
                })
                .execute();
            console.log("正式訂單:", newOrder)
            if(newOrder.identifiers.length === 0){
                logger.warn("新增正式訂單失敗");
                console.log("新增正式訂單失敗");
                return
            }
            const orderId = newOrder.identifiers[0].id;
            console.log("正式訂單ID:", orderId)
            const pendingItems = pendingOrderItems.map(item =>{
                return {
                    order_id: orderId,
                    product_id: item.product_id,
                    product_title: item.product_title,
                    quantity: parseInt(item.quantity),
                    price: parseInt(item.price),
                    subtotal: parseInt(item.subtotal),
                    is_reviewed: false,
                }
            })
            console.log("訂單項目:", pendingItems)
            //新增正式訂單商品關聯
            const newOrderItems = await transactionalEntityManager
                .createQueryBuilder()
                .insert()
                .into("OrdersItems")
                .values(pendingItems)
                .execute();
            if(newOrderItems.identifiers.length === 0){
                logger.warn("新增正式訂單商品關聯失敗");
                console.log("新增正式訂單商品關聯失敗");
                return
            }
            //新增付款交易
            const newTransaction = await transactionalEntityManager
                .createQueryBuilder()
                .insert()
                .into("PaymentTransactions")
                .values({
                    order_id: orderId,
                    merchant_order_no: result.MerchantOrderNo,
                    transaction_number: result.TradeNo,
                    payment_type: result.PaymentType,
                    amount: parseInt(result.Amt),
                    currency:"TWD",
                    status: (decrypted.Status).toLowerCase(),
                    payment_time: new Date(result.PayTime).toISOString(),
                    bank_code: result.PayBankCode ? result.PayBankCode : null,
                    payer_account5code: result.PayerAccount5Code ? result.PayerAccount5Code : null,
                    account_number: result.CodeNo ? result.CodeNo : null,
                    barcode_1: result.Barcode_1 ? result.Barcode_1 : null,
                    barcode_2: result.Barcode_2 ? result.Barcode_2 : null,
                    barcode_3: result.Barcode_3 ? result.Barcode_3 : null,
                    auth_code: result.Auth ? result.Auth : null,
                    card_start6: result.Card6No ? result.Card6No : null,
                    card_last4: result.Card4No ? result.Card4No : null,
                    return_code: result.RespondCode ? result.RespondCode : null,
                    return_message: decrypted.Message,
                    raw_response: JSON.stringify(decrypted)
                })
                .execute();
            if(newTransaction.identifiers.length === 0){
                logger.warn("新增交易紀錄失敗");
                console.log("新增交易紀錄失敗");
                return
            }
            //新增折扣碼使用紀錄
            if(existPendingOrder.discount_code){
                const discountCode = await transactionalEntityManager.findOneBy("DiscountCodes", {code: existPendingOrder.discount_code});
                console.log("使用折扣碼資料:", discountCode)
                const newUsage = await transactionalEntityManager
                    .createQueryBuilder()
                    .insert()
                    .into("DiscountCodeUsages")
                    .values({
                        code_id: discountCode.id,
                        order_id: orderId,
                        user_id: existPendingOrder.user_id,
                        discount_amount: parseInt(existPendingOrder.discount_amount),
                    })
                    .execute();
                if(newUsage.identifiers.length === 0){
                    logger.warn("新增折扣碼使用紀錄失敗");
                    console.log("新增折扣碼使用紀錄失敗");
                    return
                }
                //折扣碼使用次數+1
                await transactionalEntityManager
                    .createQueryBuilder("DiscountCodes")
                    .update()
                    .set({
                        used_count: () => "used_count + 1"
                    })
                    .where("DiscountCodes.code =:code", {code: existPendingOrder.discount_code})
                    .execute();
            }
            //變更暫存訂單狀態為paid
            const updatedUsage = await transactionalEntityManager
                .createQueryBuilder("PendingOrders")
                .update()
                .set({
                    status: "paid"
                })
                .where("PendingOrders.order_number =:orderNumber", {orderNumber: result.MerchantOrderNo})
                .execute();
            if(updatedUsage.affected === 0){
                logger.warn("更新折扣碼使用紀錄失敗")
                console.log("更新折扣碼使用紀錄失敗");
                return
            }
            //清空購物車商品
            const deleteCartItems = await transactionalEntityManager
                .createQueryBuilder()
                .delete()
                .from("CartItems")
                .where("order_id =:orderId", {orderId: orderId})
                .execute();
            if(deleteCartItems.affected === 0){
                logger.warn("清空購物車商品失敗")
                console.log("清空購物車商品失敗");
                return
            }else{
                console.log(`成功清空 ${deleteCartItems.affected} 筆 購物車商品`)
            }
        })
        //取出正式記錄
        const orderData = await dataSource.getRepository("Orders")
            .createQueryBuilder("orders")
            .innerJoin("PaymentTransactions", "transaction", "transaction.order_id = orders.id")
            .innerJoin("orders.User", "user")
            .select([
                "order.order_number AS order_number",
                "order.order_status AS order_status",
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
            .where("orders.order_number =:orderNumber", {orderNumber: result.MerchantOrderNo})
            .getRawOne();
        //寄信通知用戶
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
            paper: "紙本發票"
        };
        const officalOrder = {
            orderNumber: orderData.order_number,
            orderStaus: orderStatusList[orderData.order_status],
            paymentStaus: paymentStatusList[orderData.payment_status],
            shippingStaus: shippingStatusList[orderData.shipping_status],
            createdAt: convertUtcToTaipei(orderData.created_at),
            userName: orderData.username ? orderData.username : orderData.email,
            payTime: convertUtcToTaipei(orderData.payment_time),
            amount: parseInt(orderData.amount),
            paymentMethod: paymentMethodList[orderData.payment_method],
            invoiceType: invoiceTypeList[orderData.invoice_type],
            shippingMethod: shippingMethodList[orderData.shipping_method],
            recipientName: orderData.recipient_name,
            recipientEmail: orderData.recipient_email,
            recipientPhone: orderData.recipient_phone,
            shippingAddress: orderData.shipping_address,
            note: orderData.note ? orderData.note : "未填寫",
            totalAmount: parseInt(orderData.total_amount),
            discountAmount: parseInt(orderData.discount_amount),
            shippingFee: parseInt(orderData.shipping_fee),
            finalAmount: parseInt(orderData.final_amount)
        };
        const officalOrderItems = await dataSource.getRepository("OrderItems").find({order_id: orderId});
        let officalItemsStr = "";
        officalOrderItems.forEach(item =>{
            officalItemsStr += `<li class="column">
                                <p>${item.title}</p>
                                <p>NT$${parseInt(item.price)}</p>
                                <p>X ${item.quantity}</p>
                                <p>NT$${parseInt(item.subtotal)}</p>
                            </li>`;
        })
        const emailSent = await sendOrderConfirmationEmail(orderData.email, officalOrder, officalItemsStr);
        if(emailSent === true){
            logger.info("寄送訂單成立信件成功")
        }else{
            logger.warn("寄送訂單成立信件失敗")
            console.log("寄送訂單成立信件失敗");
        }
        //開立發票
        const invoiceData = generateEzpay(orderData, officalOrderItems);
        const { data } = await axios.post(EZPAY_API_URL, invoiceData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        if(data.Status === "SUCCESS"){
            const invoiceResult = JSON.parse(data.Result);
            console.log(invoiceResult);
            const newInvoice = await dataSource.getRepository("Invoices")
                .createQueryBuilder("invoices")
                .insert()
                .into()
                .values({
                    merchant_order_no: invoiceResult.ORD1747858395058,
                    invoice_number: invoiceResult.InvoiceNumber,
                    total_amount: parseInt(invoiceResult.TotalAmt),
                    invoice_trans_no: invoiceResult.InvoiceTransNo,
                    random_number: invoiceResult.RandomNum,
                    barcode: invoiceResult.BarCode ? invoiceResult.BarCode : null,
                    qrcode_l: invoiceResult.QRcodeL ? invoiceResult.QRcodeL : null,
                    qrcode_r: invoiceResult.QRcodeR ? invoiceResult.QRcodeR : null,
                    check_code: invoiceResult.CheckCode,
                    create_time: invoiceResult.CreateTime
                })
            if(newInvoice.identifiers.length === 0){
                console.log("新增發票資料失敗")
                return
            }
        }else{
            console.log(`${data.Status}:${data.Message}`);
        }
    }catch(error){
        logger.error('金流背景回傳錯誤:', error);
        next(error);
    }
})

module.exports = router;