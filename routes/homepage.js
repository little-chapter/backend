const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Homepage');
const {isNotValidString} = require("../utils/validUtils")

router.get("/", async(req, res, next)=>{
    try{
        const allowedSectionNames = {
            popularProducts: "熱門書籍",
            latestProducts: "本月亮點新書",
            bundleRecommendations: "套裝推薦",
        }
        const {sectionName} = req.query;
        if(!sectionName || isNotValidString(sectionName)){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符"
            })
            return
        }
        if(!(sectionName in allowedSectionNames)){
            res.status(400).json({
                status: false,
                message: "不支援的搜尋條件"
            })
            return
        }
        const productsData = await dataSource.getRepository("RecommendationProducts")
            .createQueryBuilder("rp")
            .innerJoin("rp.RecommendationSections", "rs")
            .innerJoin("rp.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
            .innerJoin("products.AgeRanges", "ageRanges")
            .innerJoin("products.Categories", "categories")
            .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
            .select([
                "rp.product_id AS id",
                "products.title AS title",
                "products.author AS author",
                "products.publisher AS publisher",
                "image.image_url AS image_url",
                "ageRanges.name AS age_range_name",
                "categories.name AS category_name",
                "products.price AS price",
                "products.discount_price AS discount_price",
                "products.is_new_arrival AS is_new_arrival",
                "products.is_bestseller AS is_bestseller",
                "products.introduction_html AS introduction_html",
            ])
            .where("rs.name =:section_name", {section_name: sectionName})
            .orderBy("products.publish_date", "DESC")
            .getRawMany();
        const productResult = productsData.map(product =>{
            return {
                id: product.id,
                title: product.title,
                author: product.author,
                publisher: product.publisher,
                imageUrl: product.image_url,
                ageRangeName: product.age_range_name,
                categoryName: product.category_name,
                price: parseInt(product.price),
                discountPrice: parseInt(product.discount_price),
                isNewArrival: product.is_new_arrival,
                isBestseller: product.is_bestseller,
                introductionHtml: product.introduction_html,
            }
        });
        res.status(200).json({
            status: true,
            data: {
                title: allowedSectionNames[sectionName],
                books: productResult
            }
        })
    }catch(error){
        logger.error('取得首頁錯誤:', error);
        next(error);
    }
})

module.exports = router;