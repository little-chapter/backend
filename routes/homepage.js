const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Homepage');
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")

const recommendationSectionName = {
    popularProducts: "熱門書籍",
    latestProducts: "本月亮點新書",
    bundleRecommendations: "套裝推薦",
};
router.get("/", async(req, res, next)=>{
    try{
        const sectionNames = [
            "ageRanges",
            "popularProducts",
            "latestProducts",
            "bundleRecommendations",
        ]
        const {sectionName} = req.query;
        if (!sectionNames.includes(sectionName)){
            res.status(400).json({
                status: false,
                message: "不支援的搜尋條件"
            })
            return
        }
        if(!sectionName || isNotValidString(sectionName)){
                res.status(400).json({
                status: false,
                message: "欄位資料格式不符"
            })
            return
        }
        if(sectionName === "ageRanges"){
            const ageRanges = await dataSource.getRepository("AgeRanges")
                .createQueryBuilder("ageRanges")
                .select([
                    ("ageRanges.id AS id"),
                    ("ageRanges.name AS name"),
                ])
                .getRawMany();
            res.status(200).json({
                status: true,
                data: {
                    ageRanges: ageRanges
                }
            })
        }
        if(sectionName === "popularProducts"){
            const popularProducts = await dataSource.getRepository("RecommendationProducts")
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
                    "products.is_discount AS is_discount",
                ])
                .where("rs.name =:section_name", {section_name: sectionName})
                .getRawMany();
            const popularResult = popularProducts.map(product =>{
                return {
                    id: product.id,
                    title: product.title,
                    author: product.author,
                    publisher: product.publisher,
                    imageUrl: product.image_url,
                    ageRangeName: product.age_range_name,
                    categoryName: product.category_name,
                    price: product.price,
                    discountPrice: product.discount_price,
                    isNewArrival: product.is_new_arrival,
                    isBestseller: product.is_bestseller,
                    isDiscount: product.is_discount,
                }
            });
            res.status(200).json({
                status: true,
                data: {
                    title: recommendationSectionName[sectionName],
                    books: popularResult
                }
            })
        }
        if(sectionName === "latestProducts"){
            const latestProducts = await dataSource.getRepository("RecommendationProducts")
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
                    "products.introduction_html AS introduction_html",
                    "products.is_new_arrival AS is_new_arrival",
                ])
                .where("rs.name =:section_name", {section_name: sectionName})
                .getRawMany();
            const lastestResult = latestProducts.map(product =>{
                return {
                    id: product.id,
                    title: product.title,
                    author: product.author,
                    publisher: product.publisher,
                    imageUrl: product.image_url,
                    ageRangeName: product.age_range_name,
                    categoryName: product.category_name,
                    introductionHtml: product.introduction_html,
                    isNewArrival: product.is_new_arrival
                }
            });
            res.status(200).json({
                status: true,
                data: {
                    title: recommendationSectionName[sectionName],
                    books: lastestResult
                }
            })
        }
        if(sectionName === "bundleRecommendations"){
            const bundleRecommendations = await dataSource.getRepository("RecommendationProducts")
                .createQueryBuilder("rp")
                .innerJoin("rp.RecommendationSections", "rs")
                .innerJoin("rp.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
                .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
                .select([
                    "rp.product_id AS id",
                    "products.title AS title",
                    "image.image_url AS image_url",
                    "products.introduction_html AS introduction_html"
                ])
                .where("rs.name =:section_name", {section_name: sectionName})
                .getRawMany();
            const bundleResults = bundleRecommendations.map(bundle =>{
                return {
                    id: bundle.id,
                    title: bundle.title,
                    imageUrl: bundle.image_url,
                    introductionHtml: bundle.introduction_html
                }
            });
            res.status(200).json({
                status: true,
                data: {
                    title: recommendationSectionName[sectionName],
                    bundles: bundleResults
                }
            })
        }
    }catch(error){
        logger.error('取得首頁錯誤:', error);
        next(error);
    }
})

module.exports = router;