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
        const resSHA = sha256(`HashKey=${NEWEPAY_HASHKEY}&${raw}&HashIV=${NEWEPAY_HASHIV}`).toUpperCase();
        console.log('resSHA:',resSHA)
        if(resSHA !== req.body.TradeSha){
            logger.warn("回傳TradeSha錯誤");
            console.log("回傳TradeSha錯誤");
            return
        }
        //解密驗證
        const decrypted = decryptAES(raw, NEWEPAY_HASHKEY, NEWEPAY_HASHIV);
        console.log("解密decrypted:", decrypted);
        const result = decrypted.Result; //回傳細節
        const payTime = result.PayTime; //交易時間
        const orderNumber = result.MerchantOrderNo; //訂單編號
        //非成功交易
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
                    payment_time: new Date(payTime.slice(0, 10) + " " + payTime.slice(10)).toISOString(),
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
        }else{
            const now = new Date().toISOString();
            
            //建立交易資料
            await dataSource.getRepository("PaymentTransactions")
                .createQueryBuilder()
                .insert()
                .values({
                    merchant_order_no: orderNumber,
                    transaction_number: result.TradeNo,
                    payment_type: result.PaymentType,
                    amount: result.Amt,
                    status: decrypted.Status,
                    payment_time: new Date(payTime.slice(0, 10) + " " + payTime.slice(10)).toISOString(),
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
            //確認orderNumber存在於PendingOrders且訂單編號及總金額皆正確
            const pendingOrder = await dataSource.getRepository("PendingOrders")
                .createQueryBuilder("pendingOrders")
                .where("pendingOrders.order_number :=orderNumber", {orderNumber: orderNumber})
                .andWhere("pendingOrders.status =:status", {status: "pending"})
                .andWhere("pendingOrders.expired_at >=:expiredAt", {expiredAt: now})
                .getRawOne();
            if(!pendingOrder || Number(result.Amt) !== Number(pendingOrder.final_amount)){
                logger.warn(`暫存訂單編號${orderNumber}不存在或交易金額與訂單總金額不符`)
                return
            }
            const pendingOrderId = pendingOrder.id;
            const pendingOrderItems = await dataSource.getRepository("PendingOrderItems").find({pending_order_id: pendingOrderId});
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
                //取得正式訂單ID
                const newOrderId = newOrder.identifiers[0].id;
                for(const item of pendingOrderItems){
                    await transactionalEntityManager
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
                }
                //刪除userId的所有購物車項目(CartItems)
                await transactionalEntityManager
                    .createQueryBuilder()
                    .delete()
                    .from("CartItems")
                    .where("user_id =:userId", {userId: userId})
                    .execute();
                //刪除該orderNumber的暫存訂單、暫存訂單項目(PendingOrders、PendingOrderItems)
                await transactionalEntityManager
                    .createQueryBuilder()
                    .delete()
                    .from("PendingOrders")
                    .where("order_id =:orderId", {orderId: pendingOrderId})
                    .execute();
                await transactionalEntityManager
                    .createQueryBuilder()
                    .delete()
                    .from("PendingOrderItems")
                    .where("pending_order_id =:pendingOrderId", {pendingOrderId: pendingOrderId})
                    .execute();
                //將PendingOrderItems批次更新商品庫存(Products)並確認庫存，庫存為0就下架(is_visible=false)
                for(const item of pendingOrderItems){
                    await transactionalEntityManager
                        .createQueryBuilder()
                        .update("Products")
                        .set({
                            stock_quantity: ()=> `GREATEST(stock_quantity - ${item.quantity}, 0)`,
                            is_visible: ()=>`
                                CASE
                                    WHEN GREATEST(stock_quantity - ${item.quantity}, 0) = 0
                                    THEN false
                                    ELSE is_visible
                                END
                            `,
                            updated_at: new Date().toISOString()
                        })
                        .where("Products.id =:productId", {productId: item.product_id})
                        .execute();
                    //發送通知給所有admin該商品庫存不足已下架?
                }
                //更新折扣碼使用次數
                if(pendingOrder.discount_code){
                    const codeId = pendingOrder.discount_code;
                    await transactionalEntityManager
                        .createQueryBuilder()
                        .update("DiscountCodes")
                        .set({
                            used_count: () => "used_count + 1"
                        })
                        .where("DiscountCodes.id =:codeId", {codeId: codeId})
                        .execute();
                    //建立使用折扣碼資料
                    await transactionalEntityManager
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
                }
            })
            //取出正式訂單、正式訂單項目、使用者部分資料(Orders、OrderItems、Users)
            const officalOrder = await dataSource.getRepository("Orders")
                .createQueryBuilder("orders")
                .innerJoin("PaymentTransactions", "transaction", "transaction.order_id = orders.id")
                .innerJoin("orders.User", "user")
                .select([
                    "order.id AS id",
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
                .where("orders.order_number =:orderNumber", {orderNumber: orderNumber})
                .getRawOne();
            const officailOrderItems = await dataSource.getRepository("OrderItems")
                .createQueryBuilder("orderItems")
                .where("orderItems.order_id =:orderId", {orderId: officalOrder.id})
                .getRawMany();
            //串接發票開立API，取得EZPAY回應並建入發票資料(Invoices)
            const invoiceData = generateEzpay(officalOrder, officailOrderItems);
            const { ezpayReturn } = await axios.post(EZPAY_API_URL, invoiceData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const status = ezpayReturn.Status;
            if(status === "SUCCESS"){ //成功開立 或重複開立
                const invoiceResult = JSON.parse(ezpayReturn.Result);
                const existInvoice = await dataSource.getRepository("Invoices").findOneBy({merchant_order_no: invoiceResult.MerchantOrderNo})
                if(existInvoice){
                    console.log(`訂單編號${invoiceResult.MerchantOrderNo}已開立過發票`)
                }else{
                    const newInvoice = await dataSource.getRepository("Invoices")
                        .createQueryBuilder("invoices")
                        .insert()
                        .into()
                        .values({
                            order_id: officalOrder.id,
                            merchant_order_no: invoiceResult.MerchantOrderNo,
                            invoice_number: invoiceResult.InvoiceNumber,
                            total_amount: parseInt(invoiceResult.TotalAmt),
                            invoice_trans_no: invoiceResult.InvoiceTransNo,
                            random_number: invoiceResult.RandomNum,
                            barcode: invoiceResult.BarCode || null,
                            qrcode_l: invoiceResult.QRcodeL || null,
                            qrcode_r: invoiceResult.QRcodeR || null,
                            check_code: invoiceResult.CheckCode,
                            status: status.toLowerCase(),
                            create_time: new Date(invoiceResult.CreateTime).toISOString()
                        })
                        .execute();
                    if(newInvoice.identifiers.length === 0){
                        logger.warn(`訂單編號${invoiceResult.MerchantOrderNo}新增發票失敗`)
                        console.log(`訂單編號${invoiceResult.MerchantOrderNo}新增發票失敗`)
                    }else{
                        logger.info(`訂單編號${invoiceResult.MerchantOrderNo}新增發票成功`)
                    }
                }
                
            }else{
                //開立發票錯誤
                logger.warn(`開立發票錯誤${data.Status}:${data.Message}`)
                console.log(`開立發票錯誤${data.Status}:${data.Message}`)
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
                paper: "紙本發票"
            };
            const orderPayload = {
                orderNumber: officalOrder.order_number,
                orderStaus: orderStatusList[officalOrder.order_status],
                paymentStaus: paymentStatusList[officalOrder.payment_status],
                shippingStaus: shippingStatusList[officalOrder.shipping_status],
                createdAt: convertUtcToTaipei(officalOrder.created_at),
                userName: officalOrder.username || officalOrder.email,
                payTime: convertUtcToTaipei(officalOrder.payment_time),
                amount: parseInt(officalOrder.amount),
                paymentMethod: paymentMethodList[officalOrder.payment_method],
                invoiceType: invoiceTypeList[officalOrder.invoice_type],
                shippingMethod: shippingMethodList[officalOrder.shipping_method],
                recipientName: officalOrder.recipient_name,
                recipientEmail: officalOrder.recipient_email,
                recipientPhone: officalOrder.recipient_phone,
                shippingAddress: officalOrder.shipping_address,
                note: officalOrder.note || "未填寫",
                totalAmount: parseInt(officalOrder.total_amount),
                discountAmount: parseInt(officalOrder.discount_amount),
                shippingFee: parseInt(officalOrder.shipping_fee),
                finalAmount: parseInt(officalOrder.final_amount)
            };
            let officalItemsStr = "";
            officailOrderItems.forEach(item =>{
                officalItemsStr += `<li class="column">
                                    <p>${item.title}</p>
                                    <p>NT$${parseInt(item.price)}</p>
                                    <p>X ${item.quantity}</p>
                                    <p>NT$${parseInt(item.subtotal)}</p>
                                </li>`;
            })
            const emailSent = await sendOrderConfirmationEmail(orderData.email, orderPayload, officalItemsStr);
            if(emailSent === true){
                logger.info(`成功寄送編號${orderPayload.orderNumber}訂單成立信件`)
            }else{
                logger.warn(`寄送編號${orderPayload.orderNumber}訂單成立信件失敗`)
                console.log(`寄送編號${orderPayload.orderNumber}訂單成立信件失敗`);
            }
        }
    }catch(error){
        logger.error('金流背景回傳錯誤:', error);
        next(error);
    }
})

module.exports = router;