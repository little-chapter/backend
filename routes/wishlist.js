const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Wishlist");
const { verifyToken } = require("../middlewares/auth");
const { isNotValidString, isNotValidInteger } = require("../utils/validUtils");


// 取得願望清單
router.get("/", verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const wishlistItems = await dataSource.getRepository("Wishlists")
            .createQueryBuilder("wishlist")
            .innerJoinAndSelect("wishlist.Products", "product") // 將 Products 關聯進來 wishlist 表中並將連接後的資料命名為 "product"
            .leftJoinAndMapOne(
                // Products 物件內再掛一個 cover_image 物件
                "product.cover_image",  // 要掛到結果資料上的物件名稱
                "ProductImages",        // 來源資料表（Entity）
                "image",                // 別名
                "image.product_id = product.id AND image.is_primary = true" // 篩選條件
            )
            .where("wishlist.user_id = :userId", { userId })
            .andWhere("product.is_visible = true")
            .orderBy("wishlist.added_at", "DESC")
            .getMany();
// console.log("wishlistItems: ", wishlistItems);
// console.log("wishlistItems.Products: ", wishlistItems[0].Products);
        const result = wishlistItems.map((item) => {
            const product = item.Products;
            return {
                "productId": product.id,
                "cover_image": product.cover_image?.image_url || null, // 取得 product.cover_image.image_url，如果拿不到，就回傳 null
                "title": product.title,
                "price": parseFloat(product.price),
                "discount_price": product.discount_price ? parseFloat(product.discount_price) : null,
                "is_discount": product.is_discount,
            };
        });
        res.status(200).json({
            "status": true,
            "message": "成功取得願望清單",
            "data": result
        });
    } catch (error) {
        logger.error("取得願望清單失敗: ", error);
        next(error);
    }
});

// 新增願望商品
router.post("/", verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId = null } = req.body;

        if (!productId || isNotValidInteger(Number(productId))) {
            res.status(400).json({
                "status": false,
                "message": "欄位未填寫正確"
            });
            return;
        }

        const productsRepo = dataSource.getRepository("Products");
        const findProduct = await productsRepo.findOne({
            where: { "id": productId }
        });
        if (!findProduct) {
            res.status(404).json({
                "status": false,
                "message": "找不到該商品"
            });
            return;
        } else if (!findProduct.is_visible) {
            res.status(404).json({
                "status": false,
                "message": "該商品未上架"
            });
            return;
        }

        // 判斷將 user_id 與 product_id 寫入 Wishlists 資料表
        const wishlistRepo = dataSource.getRepository("Wishlists");
        const findWilshlistItem = await wishlistRepo.findOne({
            where: { "user_id": userId, "product_id": productId }
        });
        if (findWilshlistItem) {
            res.status(200).json({
                "status": true,
                "message": "該商品已在願望清單中"
            });
            return;
        } else {
            const newItem = wishlistRepo.create({
                "user_id": userId,
                "product_id": productId
            });
            await wishlistRepo.save(newItem);
        }

        res.status(201).json({
            "status": true,
            "message": "成功加入願望清單",
            "data": "null"
        });
    } catch (error) {
        logger.error("加入願望商品失敗: ", error);
        next(error);
    }
});

// 移除願望商品
router.delete("/:productId", verifyToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;
// console.log("productId: ",productId);
// console.log("typeof productId: ", typeof productId);

        if (!productId || isNotValidInteger(Number(productId))) {
            res.status(400).json({
                "status": false,
                "message": "欄位未填寫正確"
            });
            return;
        }

        const wishlistsRepo = dataSource.getRepository("Wishlists");
        const findWilshlistItem = await wishlistsRepo.findOne({
            where: { "user_id": userId, "product_id": productId }
        })
        if (!findWilshlistItem) {
            res.status(404).json({
                "status": false,
                "message": "您的許願清單沒有該商品可刪除"
            });
            return;
        }
        await wishlistsRepo.remove(findWilshlistItem);

        res.status(200).json({
            "status": true,
            "message": "刪除成功",
        });
    } catch (error) {
        logger.error("刪除願望商品失敗: ", error);
        next(error);
    }
});

module.exports = router;