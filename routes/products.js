const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Products');
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")

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
//取得篩選商品列表
router.get("/", async(req, res, next)=>{
    try{
        const filters = req.query;
        // 確認網址參數與格式
        for (const key of Object.keys(filters)) {
            if (!(key in allowedFilters)) {
                res.status(400).json({
                    status: false,
                    message: `不支援的搜尋條件：${key}`,
                });
                return
            }
            const expectedType = allowedFilters[key];
            const value = filters[key];
            if(expectedType === "number"){
                if(!value || isNotValidInteger(Number(value)) || Number.isNaN(Number(value))){
                    res.status(400).json({
                        status: false,
                        message: `欄位 ${key} 資料格式不符`,
                    });
                    return
                }
            }
            if(expectedType === "string"){
                if(!value || isNotValidString(value)){
                    res.status(400).json({
                        status: false,
                        message: `欄位 ${key} 資料格式不符`,
                    });
                    return
                }
            }
        }
        //撈取資料
        let productQuery = dataSource.getRepository("Products")
            .createQueryBuilder("products")
            .select([
                ("products.id AS id"),
                ("products.title AS title"),
                ("products.price AS price"),
                ("products.discount_price AS discount_price"),
                ("products.stock_quantity AS stock_quantity"),
            ]);
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
                .innerJoin("ProductLinkCategory", "plc", "plc.product_id = products.id")
                .innerJoin("Categories", "categories", "plc.category_id = categories.id")
                .andWhere("plc.category_id =:categoryId", {categoryId: categoryId});
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
                .innerJoin("AgeRanges", "ageRanges", "products.age_range_id = ageRanges.id")
                .andWhere("products.age_range_id =:ageRangeId", {ageRangeId: ageRangeId});
        }
        if(filters.author){
            const author = String(filters.author);
            productQuery = productQuery
                .andWhere("products.author ILIKE :author", {author: `%${author}%`});
        }
        if(filters.publisher){
            const publisher = String(filters.publisher);
            productQuery = productQuery
                .andWhere("products.publisher ILIKE :publisher", {publisher: `%${publisher}%`});
        }
        if(filters.priceMin){
            const priceMin = Number(filters.priceMin);
            productQuery = productQuery
                .andWhere("products.price >=:priceMin", {priceMin: priceMin});
        }
        if(filters.priceMax){
            const priceMax = Number(filters.priceMax);
            productQuery = productQuery
                .andWhere("products.price <=:priceMax", {priceMax: priceMax});
        }
        //篩選已上架商品
        productQuery = productQuery
            .andWhere("products.is_visible =:isVisible", {isVisible: true});
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
                    message: `不支援的搜尋條件： ${sortByStr}`
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
                        message: `欄位 sortOrder 資料格式不符`
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
                        message: "欄位 sortOrder 資料格式不符"
                    })
                    return
                }
                sortOrder = order;
            }
        }
        productQuery = productQuery.orderBy(`products.${sortBy}`, sortOrder)
        //總筆數
        const count = await productQuery.getCount();
        //分頁
        let page = 1;
        let limit = 20;
        if(filters.page){
            const pageNum = Number(filters.page)
            page = pageNum;
        }
        if(filters.limit){
            const limitNum = Number(filters.limit)
            limit = limitNum;
        }
        const skip = (page - 1) * limit;
        const productsData = await productQuery.skip(skip).take(limit).getRawMany();
        //取得商品主要圖片
        async function processProducts(productsData){
            const productsResult = productsData.map(async (product) =>{
                const imageUrl = await dataSource.getRepository("ProductImages").findOne({
                    select: ["image_url"],
                    where: {
                        product_id: product.id,
                        is_primary: true,
                    }
                })
                if(imageUrl){
                    product.imageUrl = imageUrl.image_url;
                }else{
                    product.imageUrl = null;
                }
                return {
                            productId: product.id,
                            title: product.title,
                            price: product.price,
                            discountPrice: product.discount_price,
                            imageUrl: product.imageUrl,
                            stockQuantity: product.stock_quantity
                        }
            });
            const resolvedProducts = await Promise.all(productsResult)
            return resolvedProducts
        }
        processProducts(productsData)
            .then(data =>{
                res.status(200).json({
                    status: true,
                    data: {
                        pagination:{
                            page: page,
                            limit: limit,
                            total: count,
                            totalPages: Math.ceil(count / limit),
                        },
                        products: data
                        
                    }
                })
            })
            .catch(error =>{
                logger.error('取得商品主要圖片錯誤:', error);
                next(error);
            })
    } catch (error) {
        logger.error('取得商品列表錯誤:', error);
        next(error);
    }
})


module.exports = router;