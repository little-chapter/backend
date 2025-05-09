const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Cart');
const { verifyToken } = require("../middlewares/auth");
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils");



router.get("/cart", verifyToken,  async(req, res, next)=> {
    try{
        const userId = req.user?.id;
        const sessionId = req.sessionID;
        const cartRepo = dataSource.getRepository("CartItem");
        
        const where = userId
            ? { user: { id: userId } }
            : { session_id: sessionId };
        
        const cartItems = await cartRepo.find({
            where,
            relations :["Products"],
            order:{ created_at: "DSC"}
        });
        const result = cartItems.map((item)=> ({
            "productId": item.product.id,
            "productTitle": item.product.title,
            "quantity": item.quantity,
            "price": item.price,
            "discountPrice": item.product.discount_price,
            "subtotal": item.quantity * parseFloat(item.product.discount_price)
        }));

        res.status(200).json({
            "status": "true",
            "message": "商品已成功加入購物車",
            "data": result
        });
    }catch(error){
        logger.error("取得購物車失敗: ", error);
        next(error);
    }
});

router.post("/cart", async(req, res, next)=> {

});

router.put("/cart/:productId", async(req, res, next)=> {

});

router.delete("/cart/:productId", async(req, res, next)=> {

});

module.exports = router;