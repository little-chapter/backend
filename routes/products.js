const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Products');
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")

function formatDateToYYYYMMDD(dateString){
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始，所以要 + 1，並補零
    const day = String(date.getDate()).padStart(2, "0"); // 補零
    return `${year}-${month}-${day}`;
}

//取得篩選商品列表
router.get("/", async(req, res, next)=>{
    try{
        const filters = req.query;
        const allowedFilters = {
            page: "number",
            limit: "number",
            categoryId: "number",
            ageRangeId: "number",
            priceMin: "number",
            priceMax: "number",
            sortBy: "string",
            sortOrder: "string",
            author: "string",
            publisher: "string",
        };
        // 確認網址參數與格式
        for (const key of Object.keys(filters)) {
            if (!(key in allowedFilters)) {
                res.status(400).json({
                    status: false,
                    message: "不支援的搜尋條件",
                });
                return
            }
            const expectedType = allowedFilters[key];
            const value = filters[key];
            if(expectedType === "number"){
                if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return
                }
            }
            if(expectedType === "string"){
                if(!value || isNotValidString(value)){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return
                }
            }
        }
        let productQuery = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .innerJoin("products.AgeRanges", "ageRanges")
            .innerJoin("products.Categories", "categories")
            .leftJoin("ProductImages", "image", "image.product_id = products.id")
            .select([
                "products.id AS id",
                "products.title AS title",
                "ageRanges.name AS age_range_name",
                "categories.name AS categories_name",
                "products.author AS author",
                "products.publisher AS publisher",
                "products.price AS price",
                "products.discount_price AS discount_price",
                "image.image_url AS image_url",
                "products.is_new_arrival AS is_new_arrival",
                "products.is_bestseller AS is_bestseller",
                "products.is_discount AS is_discount",
            ])
            .where("products.is_visible =:isVisible", {isVisible: true})
            .andWhere("image.is_primary =:isPrimary", {isPrimary: true})
        if(filters.categoryId){
            const categoryId = Number(filters.categoryId);
            const existCategoryId = await dataSource.getRepository("Categories").findOneBy({id: categoryId})
            if(!existCategoryId){
                res.status(404).json({
                    status: false,
                    message: "找不到此主題分類"
                })
                return
            }
            productQuery = productQuery
                .andWhere("categories.id =:categoryId", {categoryId: categoryId})
        }
        if(filters.ageRangeId){
            const ageRangeId = Number(filters.ageRangeId);
            const existAgeRange = await dataSource.getRepository("AgeRanges").findOneBy({id: ageRangeId});
            if(!existAgeRange){
                res.status(404).json({
                    status: false,
                    message: "找不到此年齡分類"
                })
                return
            }
            productQuery = productQuery
                .andWhere("ageRanges.id =:ageRangeId", {ageRangeId: ageRangeId})
        }
        if(filters.author){
            const author = String(filters.author);
            productQuery = productQuery
                .andWhere("products.author ILIKE :author", {author: `%${author}%`})
        }
        if(filters.publisher){
            const publisher = String(filters.publisher);
            productQuery = productQuery
                .andWhere("products.publisher ILIKE :publisher", {publisher: `%${publisher}%`})
        }
        if(filters.priceMin){
            const priceMin = Number(filters.priceMin);
            productQuery = productQuery
                .andWhere("products.price >=:priceMin", {priceMin: priceMin})
        }
        if(filters.priceMax){
            const priceMax = Number(filters.priceMax);
            productQuery = productQuery
                .andWhere("products.price <=:priceMax", {priceMax: priceMax})
        }
        //排序依據
        let sortOrder = "ASC";
        let sortBy = "publish_date"
        const allowedSortOrder = {
            price: "price",
            publishDate: "publish_date",
            title: "title",
        };
        if(filters.sortBy){
            const sortByStr = String(filters.sortBy);
            if(!(sortByStr in allowedSortOrder)){
                res.status(400).json({
                    status: false,
                    message: `不支援的搜尋條件`
                })
                return
            }
            sortBy = allowedSortOrder[sortByStr]
            //升降序
            if(filters.sortOrder){
                const order = String(filters.sortOrder).toUpperCase();
                if(!(order === "DESC" || order === "ASC")){
                    res.status(400).json({
                        status: false,
                        message: `欄位資料格式不符`
                    })
                    return
                }
                sortOrder = order;
            }
        }else{
            if(filters.sortOrder){
                const order = String(filters.sortOrder).toUpperCase();
                if(!(order === "DESC" || order === "ASC")){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符"
                    })
                    return
                }
                sortOrder = order;
            }
        }
        productQuery = productQuery.orderBy(`products.${sortBy}`, sortOrder)
        //總筆數
        const countQuery = productQuery.clone();
        const count = await countQuery.getCount();
        // 分頁
        let page = 1;
        let limit = 20;
        if(filters.page && Number(filters.page) >1){
            page = Number(filters.page);
        }
        if(filters.limit && Number(filters.limit) >= 1){
            limit = Number(filters.limit)
        }
        let totalPages = Math.max(1, Math.ceil(count / limit)); //總頁數至少為1
        if(page > totalPages){
            page = totalPages
        }
        const skip = (page - 1) * limit;
        const productsData = await productQuery
            .offset(skip)
            .limit(limit)
            .getRawMany();
        const productsResult = productsData.map(product =>{
            return {
                productId: product.id,
                title: product.title,
                ageRangeName: product.age_range_name,
                categoryName: product.categories_name,
                author: product.author,
                publisher: product.publisher,
                price: parseInt(product.price),
                discountPrice: parseInt(product.discount_price),
                imageUrl: product.image_url,
                isNewArrival: product.is_new_arrival,
                isBestseller: product.is_bestseller,
                isDiscount: product.is_discount
            }
        })
        res.status(200).json({
            status: true,
            data: {
                pagination:{
                    page: page,
                    limit: limit,
                    total: count,
                    totalPages: totalPages,
                },
                products: productsResult
            }
        })
    } catch (error) {
        logger.error('取得商品列表錯誤:', error);
        next(error);
    }
})
//取得商品評價
router.get("/reviews", async(req, res, next)=>{
    try{
        let {productId} = req.query;
        if(!productId){
            //撈所有評價
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
                    "pr.created_at AS created_at"
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
                    username: review.username,
                    createdAt: formatDateToYYYYMMDD(review.created_at)
                }
            });
            let count = 0;
            let averageRating = 0;
            if(reviewsResult.length !== 0){
                count = reviewsResult.length;
                let totalRatings = 0;
                reviewsResult.forEach(review =>{
                    totalRatings += review.rating;
                })
                averageRating = totalRatings / count;
            }
            res.status(200).json({
                status: true,
                data: {
                    averageRating: averageRating,
                    reviewCount: count,
                    reviews: reviewsResult
                }
            })
        }else{
            productId = Number(productId);
            if(isNotValidInteger(productId) || Number.isNaN(productId)){
                res.status(400).json({
                    status: false,
                    message: "欄位資料不符合格式"
                })
                return
            }
            const existProduct = await dataSource.getRepository("Products").findOneBy({id: productId});
            if(!existProduct){
                res.status(400).json({
                    status: false,
                    message: "找不到此商品"
                })
                return
            }
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
                    "pr.created_at AS created_at"
                ])
                .where("products.id =:productId", {productId: productId})
                .orderBy("pr.created_at", "ASC")
                .getRawMany();
            const reviewsResult = productReviews.map(review =>{
                return {
                    productId: review.pid,
                    productTitle: review.title,
                    productImageUrl: review.image_url,
                    content: review.content,
                    rating: review.rating,
                    username: review.username,
                    createdAt: formatDateToYYYYMMDD(review.created_at)
                }
            });
            let count = 0;
            let averageRating = 0;
            if(reviewsResult.length !== 0){
                count = reviewsResult.length;
                let totalRatings = 0;
                reviewsResult.forEach(review =>{
                    totalRatings += review.rating;
                })
                averageRating = totalRatings / count;
            }
            res.status(200).json({
                status: true,
                data: {
                    averageRating: averageRating,
                    reviewCount: count,
                    reviews: reviewsResult
                }
            })
        }
    }catch(error){
        logger.error('取得評價列表錯誤:', error);
        next(error);
    }
})
//取得商品詳細資料
router.get("/:productId", async(req, res, next)=>{
    try{
        let { productId } = req.params;
        productId = Number(productId);
        if(!productId || isNotValidInteger(productId) || Number.isNaN(productId)){
            res.status(400).json({
                status: false,
                message: "欄位資料不符合格式"
            })
            return
        }
        const existProduct = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .where("products.id =:productId", {productId: productId})
            .getExists();
        if(!existProduct){
            res.status(404).json({
                status: false,
                message: "找不到此商品"
            })
            return
        }
        const productData = await dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .innerJoin("products.AgeRanges", "ageRanges")
            .innerJoin("products.Categories", "categories")
            .select([
                "products.id AS id",
                "products.title AS title",
                "products.price AS price",
                "products.discount_price AS discount_price",
                "products.stock_quantity AS stock_quantity",
                "categories.id AS categories_id",
                "categories.name AS categories_name",
                "products.age_range_id AS age_range_id",
                "ageRanges.name AS age_range_name",
                "products.isbn AS isbn",
                "products.author AS author",
                "products.illustrator AS illustrator",
                "products.publisher AS publisher",
                "products.publish_date AS publish_date",
                "products.page_count AS page_count",
                "products.introduction_html AS introduction_html",
            ])
            .where("products.id =:productId", {productId: productId})
            .getRawOne();
        // 取得商品圖片
        const allImages = await dataSource.getRepository("ProductImages")
            .createQueryBuilder("images")
            .select([
                "images.image_url AS image_url",
                "images.is_primary AS is_primary"
            ])
            .where("images.product_id =:productId", {productId: productData.id})
            .orderBy("display_order")
            .getRawMany();
        const productImages = allImages.map(image =>{
            return {
                imageUrl: image.image_url,
                isPrimary: image.is_primary
            }
        })
        res.status(200).json({
            status: true,
            data: {
                productId: productData.id,
                title: productData.title,
                price: parseInt(productData.price),
                discountPrice: parseInt(productData.discount_price),
                stockQuantity: productData.stock_quantity,
                categoryInfo: {
                    id: productData.categories_id,
                    name: productData.categories_name
                },
                ageRange: {
                    id: productData.age_range_id,
                    name: productData.age_range_name
                },
                imageUrls: productImages,
                author: productData.author,
                illustrator: productData.illustrator,
                publisher: productData.publisher,
                publishDate: formatDateToYYYYMMDD(productData.publish_date),
                isbn: productData.isbn,
                pageCount: productData.page_count,
                introductionHtml: productData.introduction_html
            }
        })
    }catch(error){
        logger.error('取得商品詳細資料錯誤:', error);
        next(error);
    }
})

module.exports = router;