const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Cart');
const { verifyToken } = require("../middlewares/auth");
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils");
const ProductImageSchema = require("../db/entities/ProductImageSchema");

// 取得購物車商品
router.get("/", verifyToken, async(req, res, next)=> {
    // 從資料表 cartItems 依據 userId 取得該用戶資料，商品排序為越晚加入購物車的會越前面
    try{
        const userId = req.user.id;
        const cartItems = await dataSource.getRepository("CartItems")
            .createQueryBuilder("cart")
            .leftJoinAndSelect("cart.Products", "product")
            .leftJoinAndMapOne(
                "product.image",
                ProductImageSchema,
                "image",
                "image.product_id = product.id AND image.is_primary = true"
            )
            .where("cart.user_id = :userId", { userId })
            .orderBy("cart.created_at", "DESC")
            .getMany();

        const result = cartItems.map((item) => {
            const product = item.Products;
            const image = product.image;
            const price = Number(item.price);
            const quantity = item.quantity;
            const subtotal = Number((price * quantity).toFixed(2));
            return {
                "imageUrl": image ? image.image_url : null,
                "cartItemId": item.id,
                "productId": product.id,
                "title": product.title,
                "price": parseFloat(product.price),
                "discountPrice": product.discount_price ? parseFloat(product.discount_price) : null,
                "quantity": item.quantity,
                "stockQuantity": product.stock_quantity,
                "subtotal": subtotal
            };
        });
        
        res.status(200).json({
            "status": true,
            "message": "成功取得購物車",
            "data": {
                "items":result
            } 
        });
    }catch(error){
        logger.error("取得購物車失敗: ", error);
        next(error);
    }
});

// 把商品加入購物車
router.post("/", verifyToken, async(req, res, next)=> {
    // 提取使用者輸入的資料
    // 判斷 1: 使用者輸入的資料是否符合格式（productId, quantity）
    // 判斷 2: 是否有這個商品 id, 充足的庫存數量, 上架與否
    // 判斷 3: 是否商品有折扣
    // 判斷 4: 尋找之前使用者的購物車是否有留下商品
    // 將使用者輸入的資料寫入資料庫
    try{
        const userId = req.user.id;

        // 提取使用者輸入的資料
        const {
            "product_id": productId,
            quantity = 1                // 若使用者沒有輸入這行，則商品數量 quantity 預設為 1
        } = req.body;

        // 判斷 1: 使用者輸入的資料是否符合格式（productId, quantity）
        if( !productId || isNotValidInteger(Number(productId)) ||
        !quantity || isNotValidInteger(Number(quantity)) || Number(quantity) === 0){
            res.status(400).json({
                "status": false,
                "message": "欄位填寫錯誤"
            });
            return;
        }

        // 判斷 2: 是否有這個商品 id 和 充足的庫存數量, 上架與否
        const productsRepo = dataSource.getRepository("Products");
        const findProduct = await productsRepo.findOne({
            where:{ "id" : productId }
        });
            
        if(!findProduct){
            res.status(404).json({
                "status": false,
                "message": "找不到該商品 id"                
            });
            return;
        }else if(findProduct.stock_quantity < quantity){
            res.status(409).json({
                "status": false,
                "message": `該商品庫存不足，目前僅剩 ${findProduct.stock_quantity} 本`,
                "available_stock": findProduct.stock_quantity
            });
            return;
        }else if(!findProduct.is_visible){
            res.status(404).json({
                "status": false,
                "message": "該商品未上架"
            });
            return;          
        }

        // 判斷 3: 是否商品有折扣
        const cartItemsRepo = dataSource.getRepository("CartItems");
        let cartPrice = null;
        findProduct.is_discount ? cartPrice = findProduct.discount_price : cartPrice = findProduct.price;

        // 判斷 4: 尋找之前使用者的購物車是否有留下商品
        let findCartItem = await cartItemsRepo.findOne({
            where: { 
                "user_id": userId,
                "product_id": productId}
        });
        if (findCartItem) {
            addedCartItemQuantity = quantity + findCartItem.quantity;
            if(findProduct.stock_quantity < addedCartItemQuantity){
                res.status(409).json({
                    "status": false,
                    "message": "該商品庫存不足",
                });   
                return;             
            }
            
        // 將使用者輸入的資料寫入資料庫
            findCartItem.quantity += quantity;
            findCartItem.updated_at = new Date();
            await cartItemsRepo.save(findCartItem);
        } else {
            const newItem = cartItemsRepo.create({
                "user_id": userId,
                "product_id": productId,
                quantity,
                "price": cartPrice,
                "created_at": new Date(),
                "updated_at": new Date()
        });
            await cartItemsRepo.save(newItem);
        }
        res.status(200).json({
            "status": true,
            "message": "商品已成功加入購物車",
            "data": null 
        });

    }catch(error){
        logger.error("加入購物車失敗: ", error);
        next(error);
    }
});

// 修改購物車內商品數量
router.put("/:productId", verifyToken, async(req, res, next)=> {
    // 提取使用者輸入的資料（req.params, req.body）
    // 判斷 1: 使用者輸入的資料是否符合格式（productId, quantity）
    // 判斷 2: 是否有這個商品 id, 充足的庫存數量, 上架與否
    // 判斷 3: 該 user 在購物車是否有留存該商品
    // 更新 cart 資料表的資料
    try{
        const userId = req.user.id;
        // 提取使用者輸入的資料（req.params, req.body）
        const {productId} = req.params;
        const {quantity} = req.body;

        // 判斷 1: 使用者輸入的資料是否符合格式（productId, quantity）
        if(isNotValidInteger(Number(productId)) ||
        !quantity || isNotValidInteger(Number(quantity)) || Number(quantity) === 0){
            res.status(400).json({
                "status": false,
                "message": "欄位填寫錯誤"
            });
            return;
        }

        // 判斷 2: 是否有這個商品 id, 充足的庫存數量, 上架與否
        const productsRepo = dataSource.getRepository("Products");
        const findProduct = await productsRepo.findOne({
            where:{"id": productId}
        });

        if(!findProduct){
            res.status(404).json({
                "status": false,
                "message": "找不到此商品於您的購物車中"                
            });
            return;
        }else if(findProduct.stock_quantity < quantity){
            res.status(409).json({
                "status": false,
                "message": `該商品庫存不足，目前僅剩 ${findProduct.stock_quantity} 本`,
                "available_stock": findProduct.stock_quantity
            });
            return;
        }else if(!findProduct.is_visible){
            res.status(404).json({
                "status": false,
                "message": "該商品未上架"
            });
            return;          
        }

        let cartPrice = null;
        findProduct.is_discount ? cartPrice = findProduct.discount_price : cartPrice = findProduct.price;
        
        // 判斷 3: 該 user 在購物車是否有留存該商品
        const cartItemsRepo = dataSource.getRepository("CartItems");
        const findCartItem = await cartItemsRepo.findOne({
            where:{"user_id": userId, "product_id": productId}
        });
        
        // 更新 cart 資料表的資料
        if(findCartItem){
            findCartItem.quantity = quantity;
            findCartItem.updated_at = new Date();
            await cartItemsRepo.save(findCartItem);
        } else{
            const newItem = cartItemsRepo.create({
                "user_id": userId,
                "product_id": productId,
                quantity,
                "price": cartPrice,
                "created_at": new Date(),
                "updated_at": new Date()
            });
            await cartItemsRepo.save(newItem);
        }
        res.status(200).json({
            "status": true,
            "message": "商品數量已成功更新",
            "data":{
                quantity
            }
        });
        
    }catch(error){
        logger.error("商品數量修改失敗: ", error);
        next(error);        
    }
});

// 移除購物車內指定商品
router.delete("/:productId", verifyToken, async(req, res, next)=> {
    // 提取使用者輸入的資料
    // 判斷 1: 使用者輸入的資料是否符合格式
    // 判斷 2: 該商品是否存在於購物車
    // 將商品於購物車刪除
    try{
        const userId = req.user.id;

        // 提取使用者輸入的資料
        const { productId } = req.params;
        
        // 判斷 1: 使用者輸入的資料是否符合格式
        if(isNotValidInteger(Number(productId)) || Number(productId)===0){
            res.status(400).json({
                "status": false,
                "message": "欄位填寫錯誤"
            });
        }
        const cartItemsRepo = dataSource.getRepository("CartItems");
        const findCartItem = await cartItemsRepo.findOne({
            where:{"user_id": userId, "product_id": productId}
        });
        if(findCartItem){
            await cartItemsRepo.remove(findCartItem);
        } else{
            res.status(404).json({
                "status": false,
                "message": "找不到指定商品於購物車中"
            });
        }
        res.status(200).json({
            "status": true,
            "message": "商品已成功從購物車中移除"
        });

    }catch(error){
        logger.error("移除購物車商品失敗: ", error);
        next(error);        
    }
});

// 清空購物車
router.delete("/", verifyToken, async(req, res, next)=> {
    
    try{
        const userId = req.user.id;
        const cartItemsRepo = dataSource.getRepository("CartItems");
        const findCartItems = await cartItemsRepo.find({
            where:{"user_id": userId}
        })
        if(findCartItems.length === 0){
            res.status(200).json({
                "status": true,
                "message": "購物車本來就是空的"
            });
        } else{
            await cartItemsRepo.remove(findCartItems);
        }
        res.status(200).json({
            "status": true,
            "message": "購物車已清空"
        });
    }catch(error){
        logger.error("清空購物車商品失敗: ", error);
        next(error);        
    }
});

module.exports = router;