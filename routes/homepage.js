const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Homepage');

const sectionName = {
    popularProducts: "限時搶購",
    latestProducts: "本月亮點新書",
    bundleRecommendations: "套裝推薦",
};
router.get("/", async(req, res, next)=>{
    try{
        //年齡分類
        const ageRanges = await dataSource.getRepository("AgeRanges")
            .createQueryBuilder("ageRanges")
            .select([
                ("ageRanges.id AS id"),
                ("ageRanges.name AS name"),
            ])
            .getRawMany();
        //熱門商品
        const popularProducts = await dataSource.getRepository("RecommendationProducts")
            .createQueryBuilder("rp")
            .innerJoin("rp.RecommendationSections", "rs")
            .innerJoin("rp.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
            .innerJoin("products.AgeRanges", "ageRanges")
            .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
            .select([
                "rp.product_id AS id",
                "products.title AS title",
                "products.author AS author",
                "products.publisher AS publisher",
                "image.image_url AS image_url",
                "ageRanges.name AS age_range_name",
                "products.price AS price",
                "products.discount_price AS discount_price",
            ])
            .where("rs.name =:section_name", {section_name: Object.keys(sectionName)[0]})
            .getRawMany();
        const popularResult = popularProducts.map(product =>{
            return {
                id: product.id,
                title: product.title,
                author: product.author,
                publisher: product.publisher,
                imageUrl: product.image_url,
                ageRangeName: product.age_range_name,
                price: product.price,
                discountPrice: product.discount_price
            }
        });
        //最新商品
        const latestProducts = await dataSource.getRepository("RecommendationProducts")
            .createQueryBuilder("rp")
            .innerJoin("rp.RecommendationSections", "rs")
            .innerJoin("rp.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
            .innerJoin("AgeRanges", "ageRanges", "ageRanges.id = products.age_range_id")
            .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
            .select([
                "rp.product_id AS id",
                "products.title AS title",
                "products.author AS author",
                "products.publisher AS publisher",
                "image.image_url AS image_url",
                "ageRanges.name AS age_range_name",
                "products.description AS description"
            ])
            .where("rs.name =:section_name", {section_name: Object.keys(sectionName)[1]})
            .getRawMany();
        const lastestResult = latestProducts.map(product =>{
            return {
                id: product.id,
                title: product.title,
                author: product.author,
                publisher: product.publisher,
                imageUrl: product.image_url,
                ageRangeName: product.age_range_name,
                description: product.description,
                isNewArrival: true
            }
        });
        //套裝推薦
        const bundleRecommendations = await dataSource.getRepository("RecommendationProducts")
            .createQueryBuilder("rp")
            .innerJoin("rp.RecommendationSections", "rs")
            .innerJoin("rp.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
            .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
            .select([
                "rp.product_id AS id",
                "products.title AS title",
                "image.image_url AS image_url",
                "products.description AS description"
            ])
            .where("rs.name =:section_name", {section_name: Object.keys(sectionName)[2]})
            .getRawMany();
        const bundleResults = bundleRecommendations.map(bundle =>{
            return {
                id: bundle.id,
                title: bundle.title,
                imageUrl: bundle.image_url,
                description: bundle.description
            }
        });
        //商品評價
        const productReviews = await dataSource.getRepository("ProductReviews")
            .createQueryBuilder("pr")
            .innerJoin("pr.OrderItems", "orderItems")
            .innerJoin("pr.User", "user")
            .innerJoin("orderItems.Products", "products", "products.is_visible =:isVisible", {isVisible: true})
            .leftJoin("ProductImages", "image", "image.product_id = products.id AND image.is_primary = :isPrimary", { isPrimary: true })
            .select([
                "products.id AS pid",
                "products.title AS title",
                "image.image_url AS image_url",
                "pr.content AS content",
                "pr.rating AS rating",
                "user.name AS username",
                "user.avatar AS avatar"
            ])
            .orderBy("pr.created_at", "ASC")
            .getRawMany();
        const reviewsResult = productReviews.map(review =>{
            return {
                productId: review.pid,
                productTitle: review.title,
                productImageUrl: review.image_url,
                content: review.content,
                rating: review.rating,
                user: {
                    name: review.username,
                    avatar: review.avatar
                }
            }
        });
        res.status(200).json({
            status: true,
            data: {
                ageRanges: ageRanges,
                popularProducts: {
                    title: sectionName.popularProducts,
                    books: popularResult
                },
                latestProducts: {
                    title: sectionName.latestProducts,
                    books: lastestResult
                },
                bundleRecommendations: {
                    title: sectionName.bundleRecommendations,
                    bundles: bundleResults
                },
                featureReviews: {
                    title: "書籍好評",
                    reviews: reviewsResult
                }
            }
        })
    }catch(error){
        logger.error('取得首頁錯誤:', error);
        next(error);
    }
})

module.exports = router;