const { encryptAES } = require("./encryptUtils");
const { 
    EZPAY_MERCHANT_ID,
    EZPAY_HASH_KEY,
    EZPAY_HASH_IV,
    EZPAY_VERSION,
} = process.env;
function generateEzpay(orderData, orderItems){
    const unit = "本";
    const taxRate = 5;
    const delivery = {
        title: "運費",
        quantity: 1,
        price: orderData.shipping_amount,
        subtotal: orderData.shipping_amount,
        unit: "筆",
    }
    const discount = {
        title: "折扣碼折扣",
        price: orderData.discount_price ? `-${orderData.discount_price}` : 0,
        quantity: orderData.discount_price ? 1 : 0,
        subtotal: orderData.discount_price ? `-${orderData.discount_price * 1}` : 0,
        unit: "張"
    }
    orderItems.push(delivery, discount);
    const itemName = orderItems.map(item => item.title).join("|");
    const itemCount = orderItems.map(item => item.quantity).join("|");
    const itemUnit = orderItems.map(item => item.unit ? `${item.unit}` : unit).join("|");
    const itemPrice = orderItems.map(item => parseInt(item.price)).join("|");
    const itemAmt = orderItems.map(item => parseInt(item.subtotal)).join("|");
    const payload =  {
        respondType: "JSON",
        version: EZPAY_VERSION,
        timeStamp: Math.floor(Date.now() / 1000),
        merchantOrderNo: orderData.order_number,
        status: "1",
        category: "B2C",
        buyerName: orderData.username ? orderData.username : orderData.email,
        buyerEmail: orderData.email,
        carrierType: orderData.invoice_type = "e-invoice" ? "0" : "",
        carrierNum: orderData.carrier_number ? orderData.carrier_number : "",
        printFlag: orderData.invoice_type = "paper" ? "Y" : "N",
        taxType: "1",
        taxRate: taxRate,
        amt: Math.round(orderData.final_amount * (1 - taxRate / 100)),
        taxAmt: orderData.final_amount - Math.round(orderData.final_amount * (1 - taxRate / 100)),
        totalAmt: parseInt(orderData.final_amount),
        itemName: itemName,
        itemCount: itemCount,
        itemUnit: itemUnit,
        itemPrice: itemPrice,
        itemAmt: itemAmt,
        comment: '親子繪本',
    }
    console.log("payload:", payload)
    const postStr = `RespondType=${payload.respondType}&Version=${payload.version}&TimeStamp=${payload.timeStamp}&MerchantOrderNo=${payload.merchantOrderNo}&Status=${payload.status}&Category=${payload.category}&BuyerName=${encodeURIComponent(payload.buyerName)}&BuyerEmail=${encodeURIComponent(payload.buyerEmail)}&CarrierType=${payload.carrierType}&CarrierNum=${payload.carrierNum}&PrintFlag=${payload.printFlag}&TaxType=${payload.taxType}&TaxRate=${payload.taxRate}&Amt=${payload.amt}&TaxAmt=${payload.taxAmt}&TotalAmt=${payload.totalAmt}&ItemName=${encodeURIComponent(payload.itemName)}&ItemCount=${payload.itemCount}&ItemUnit=${encodeURIComponent(payload.itemUnit)}&ItemPrice=${payload.itemPrice}&ItemAmt=${payload.itemAmt}&Comment=${encodeURIComponent(payload.comment)}`;
    console.log("postData:",postStr)
    const encryptData = encryptAES(postStr, EZPAY_HASH_KEY, EZPAY_HASH_IV);
    return {
        "MerchantID_": EZPAY_MERCHANT_ID,
        "PostData_": encryptData
    }
}
module.exports = {
    generateEzpay,
}