const { encryptAES, sha256 } = require("./encryptUtils");
const { 
    NEWEPAY_MERCHANTID,
    NEWEPAY_HASHKEY, 
    NEWEPAY_HASHIV, 
    NEWEPAY_VERSION, 
    NEWEPAY_RETURN_URL, 
    NEWEPAY_NOTIFY_URL,
    NEWEPAY_PAYGATEWAY,
} = process.env;
function generateTradeInfo(finalAmount, email, orderNumber) {
    const data = {
        merchantID: NEWEPAY_MERCHANTID,
        respondType: "JSON",
        timeStamp: Date.now().toString(),
        version: NEWEPAY_VERSION,
        merchantOrderNo: orderNumber,
        amt: parseInt(finalAmount),
        itemDesc: "Little Chapter親子繪本商品",
        tradeLimit: 900,
        email: email,
        returnURL: NEWEPAY_RETURN_URL,
        notifyURL: NEWEPAY_NOTIFY_URL,
    };
    const tradeInfoStr = `MerchantID=${data.merchantID}&RespondType=${data.respondType}&TimeStamp=${data.timeStamp}&Version=${data.version}&MerchantOrderNo=${data.merchantOrderNo}&Amt=${data.amt}&ItemDesc=${encodeURIComponent(data.itemDesc)}&Email=${encodeURIComponent(data.email)}&ReturnURL=${encodeURIComponent(data.returnURL)}&NotifyURL=${encodeURIComponent(data.notifyURL)}&TradeLimit=${data.tradeLimit}`;
    const encrypted = encryptAES(tradeInfoStr, NEWEPAY_HASHKEY, NEWEPAY_HASHIV);
    const tradeSha = sha256(`HashKey=${NEWEPAY_HASHKEY}&${encrypted}&HashIV=${NEWEPAY_HASHIV}`).toUpperCase();
    return {
        merchantID: NEWEPAY_MERCHANTID,
        tradeInfo: encrypted,
        tradeSha: tradeSha,
        version: NEWEPAY_VERSION,
        payGateWay: NEWEPAY_PAYGATEWAY
    }
}
module.exports = {
    generateTradeInfo,
}