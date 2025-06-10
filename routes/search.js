const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Search');
const { isNotValidString, isNotValidInteger } = require("../utils/validUtils");

router.get("/", async (req, res, next) => {
    try {
        const {
            keyword = '',
            category_id,
            age_range_id,
            publisher,
            author,
            price_range,
            is_new_arrival,
            is_bestseller,
            is_discount,
            page = 1,
            limit = 12,
            sort_by = 'id',
            sort_order = 'ASC'
        } = req.query;

        console.log('🔍 搜尋參數:', {
            keyword,
            category_id,
            age_range_id,
            publisher,
            author,
            price_range,
            is_new_arrival,
            is_bestseller,
            is_discount,
            page,
            limit,
            sort_by,
            sort_order
        });

        // 驗證分頁參數
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 12;

        // 驗證分頁參數範圍
        if (pageNum < 1) {
            return res.status(400).json({
                status: false,
                message: "頁數不能小於1"
            });
        }

        if (limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                status: false,
                message: "每頁筆數必須在1-100之間"
            });
        }

        const offset = (pageNum - 1) * limitNum;

        // 建立基本查詢 - 使用leftJoinAndSelect載入關聯資料
        let queryBuilder = dataSource
            .getRepository("Products")
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.Categories", "c")
            .leftJoinAndSelect("p.AgeRanges", "a")
            .where("p.is_visible = :isVisible", { isVisible: true });

        console.log('📊 基本查詢建立完成');

        // 擴展關鍵字搜尋（搜尋所有指定欄位）
        if (keyword && keyword.trim()) {
            const keywordTrim = keyword.trim();
            queryBuilder.andWhere(
                `(p.title ILIKE :keyword 
                 OR p.description ILIKE :keyword 
                 OR p.illustrator ILIKE :keyword 
                 OR p.publisher ILIKE :keyword 
                 OR p.author ILIKE :keyword 
                 OR p.isbn ILIKE :keyword 
                 OR CAST(p.price AS TEXT) ILIKE :keyword 
                 OR CAST(p.discount_price AS TEXT) ILIKE :keyword 
                 OR CAST(p.publish_date AS TEXT) ILIKE :keyword 
                 OR CAST(p.age_range_id AS TEXT) ILIKE :keyword 
                 OR CAST(p.category_id AS TEXT) ILIKE :keyword)`,
                { keyword: `%${keywordTrim}%` }
            );
            console.log('🔍 關鍵字搜尋條件已加入:', keywordTrim);
        }

        // 主題分類篩選（支援多選）
        if (category_id) {
            console.log('🔍 原始 category_id 參數:', category_id, '型別:', typeof category_id);
            
            let categoryIds = [];
            if (Array.isArray(category_id)) {
                console.log('📝 category_id 是陣列格式');
                categoryIds = category_id
                    .map(id => {
                        const numId = parseInt(id);
                        console.log(`   轉換 ${id} -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                        return numId;
                    })
                    .filter(id => !isNaN(id) && id > 0);
            } else if (typeof category_id === 'string') {
                console.log('📝 category_id 是字串格式');
                if (category_id.includes(',')) {
                    console.log('📝 包含逗號，進行分割');
                    categoryIds = category_id.split(',')
                        .map(id => {
                            const trimmedId = id.trim();
                            const numId = parseInt(trimmedId);
                            console.log(`   分割並轉換 "${trimmedId}" -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                            return numId;
                        })
                        .filter(id => !isNaN(id) && id > 0);
                } else {
                    const numId = parseInt(category_id);
                    console.log(`📝 單一數值轉換 "${category_id}" -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                    if (!isNaN(numId) && numId > 0) {
                        categoryIds = [numId];
                    }
                }
            }
            
            console.log('📂 處理後的 categoryIds:', categoryIds);
            
            if (categoryIds.length > 0) {
                queryBuilder.andWhere("p.category_id IN (:...categoryIds)", { categoryIds });
                console.log('✅ 主題分類篩選已加入:', categoryIds);
            } else {
                console.log('❌ 主題分類篩選失敗：無有效的分類ID');
            }
        }

        // 年齡分類篩選（支援多選）
        if (age_range_id) {
            console.log('🔍 原始 age_range_id 參數:', age_range_id, '型別:', typeof age_range_id);
            
            let ageRangeIds = [];
            if (Array.isArray(age_range_id)) {
                console.log('📝 age_range_id 是陣列格式');
                ageRangeIds = age_range_id
                    .map(id => {
                        const numId = parseInt(id);
                        console.log(`   轉換 ${id} -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                        return numId;
                    })
                    .filter(id => !isNaN(id) && id > 0);
            } else if (typeof age_range_id === 'string') {
                console.log('📝 age_range_id 是字串格式');
                if (age_range_id.includes(',')) {
                    console.log('📝 包含逗號，進行分割');
                    ageRangeIds = age_range_id.split(',')
                        .map(id => {
                            const trimmedId = id.trim();
                            const numId = parseInt(trimmedId);
                            console.log(`   分割並轉換 "${trimmedId}" -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                            return numId;
                        })
                        .filter(id => !isNaN(id) && id > 0);
                } else {
                    const numId = parseInt(age_range_id);
                    console.log(`📝 單一數值轉換 "${age_range_id}" -> ${numId}, 有效: ${!isNaN(numId) && numId > 0}`);
                    if (!isNaN(numId) && numId > 0) {
                        ageRangeIds = [numId];
                    }
                }
            }
            
            console.log('👶 處理後的 ageRangeIds:', ageRangeIds);
            
            if (ageRangeIds.length > 0) {
                queryBuilder.andWhere("p.age_range_id IN (:...ageRangeIds)", { ageRangeIds });
                console.log('✅ 年齡分類篩選已加入:', ageRangeIds);
            } else {
                console.log('❌ 年齡分類篩選失敗：無有效的年齡範圍ID');
            }
        }

        // 出版社篩選
        if (publisher && !isNotValidString(publisher)) {
            queryBuilder.andWhere("p.publisher ILIKE :publisher", { 
                publisher: `%${publisher.trim()}%` 
            });
            console.log('🏢 出版社篩選已加入:', publisher);
        }

        // 作者篩選
        if (author && !isNotValidString(author)) {
            queryBuilder.andWhere("p.author ILIKE :author", { 
                author: `%${author.trim()}%` 
            });
            console.log('👨‍💼 作者篩選已加入:', author);
        }

        // 價格範圍篩選（優先使用discountPrice，如果沒有則使用price）
        if (price_range) {
            switch (price_range) {
                case '1': // 0-400
                    queryBuilder.andWhere(
                        "(COALESCE(p.discount_price, p.price) <= :maxPrice1)", 
                        { maxPrice1: 400 }
                    );
                    console.log('💰 價格範圍篩選: 0-400');
                    break;
                case '2': // 401-800
                    queryBuilder.andWhere(
                        "(COALESCE(p.discount_price, p.price) >= :minPrice2 AND COALESCE(p.discount_price, p.price) <= :maxPrice2)", 
                        { minPrice2: 401, maxPrice2: 800 }
                    );
                    console.log('💰 價格範圍篩選: 401-800');
                    break;
                case '3': // 800以上
                    queryBuilder.andWhere(
                        "(COALESCE(p.discount_price, p.price) > :minPrice3)", 
                        { minPrice3: 800 }
                    );
                    console.log('💰 價格範圍篩選: 800以上');
                    break;
                default:
                    return res.status(400).json({
                        status: false,
                        message: "價格範圍參數無效，請使用1、2或3"
                    });
            }
        }

        // 特殊標籤篩選
        if (is_new_arrival === 'true') {
            queryBuilder.andWhere("p.is_new_arrival = :isNewArrival", { isNewArrival: true });
            console.log('🆕 亮點新書篩選已加入');
        }

        if (is_bestseller === 'true') {
            queryBuilder.andWhere("p.is_bestseller = :isBestseller", { isBestseller: true });
            console.log('🔥 熱銷排行篩選已加入');
        }

        if (is_discount === 'true') {
            queryBuilder.andWhere("p.is_discount = :isDiscount", { isDiscount: true });
            console.log('💸 優惠折扣篩選已加入');
        }

        // 排序驗證與設定
        const validSortColumns = ['id', 'title', 'price', 'created_at', 'discount_price'];
        const validSortOrders = ['ASC', 'DESC'];
        
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'id';
        const sortDirection = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';
        
        queryBuilder.orderBy(`p.${sortColumn}`, sortDirection);
        console.log('📊 排序設定:', `${sortColumn} ${sortDirection}`);

        // 取得總數
        const totalQuery = queryBuilder.clone();
        const totalNum = await totalQuery.getCount();
        console.log('📈 查詢總數:', totalNum);
        
        if (totalNum === 0) {
            logger.info(`搜尋無結果: 關鍵字="${keyword}"`);
            return res.status(200).json({
                status: true,
                data: {
                    products: [],
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        totalNum: 0,
                        totalPages: 0
                    }
                }
            });
        }

        const totalPages = Math.ceil(totalNum / limitNum);

        // 檢查頁數是否超出範圍
        if (pageNum > totalPages) {
            return res.status(400).json({
                status: false,
                message: `請求的頁數超出範圍，總共只有 ${totalPages} 頁`
            });
        }

        // 分頁
        queryBuilder.offset(offset).limit(limitNum);

        // 列印最終SQL查詢
        console.log('🔧 最終SQL查詢:', queryBuilder.getSql());
        console.log('🔧 查詢參數:', queryBuilder.getParameters());

        // 執行查詢
        const results = await queryBuilder.getMany();
        console.log('📋 查詢結果數量:', results.length);
        
        if (results.length > 0) {
            console.log('📋 第一筆原始資料:', JSON.stringify(results[0], null, 2));
        }

        // 取得產品圖片資料（另外查詢）
        const productIds = results.map(p => p.id);
        let productImages = [];
        
        if (productIds.length > 0) {
            const imageQuery = dataSource
                .getRepository("ProductImages")
                .createQueryBuilder("pi")
                .where("pi.product_id IN (:...productIds)", { productIds })
                .andWhere("pi.is_primary = :isPrimary", { isPrimary: true });
            
            productImages = await imageQuery.getMany();
            console.log('🖼️ 產品圖片數量:', productImages.length);
        }

        // 建立圖片對應表
        const imageMap = {};
        productImages.forEach(img => {
            imageMap[img.product_id] = img.image_url;
        });

        // 格式化結果
        const products = results.map(product => {
            const formattedProduct = {
                productId: product.id,
                title: product.title || '',
                author: product.author || '',
                publisher: product.publisher || '',
                price: product.price ? parseFloat(product.price) : 0,
                discountPrice: product.discount_price ? parseFloat(product.discount_price) : null,
                imageUrl: imageMap[product.id] || null,
                quantity: 1, // 統一預設1
                stockQuantity: product.stock_quantity || 0,
                ageName: product.AgeRanges ? product.AgeRanges.name : '',
                categoryName: product.Categories ? product.Categories.name : ''
            };
            console.log('✅ 格式化商品:', formattedProduct);
            return formattedProduct;
        });

        logger.info(`搜尋成功: 關鍵字="${keyword}", 找到 ${totalNum} 筆結果, 第 ${pageNum} 頁`);

        res.status(200).json({
            status: true,
            data: {
                products,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalNum,
                    totalPages
                }
            }
        });

    } catch (error) {
        console.error('❌ 搜尋API發生錯誤:', error);
        logger.error('搜尋API錯誤:', error);
        
        // 資料庫連接錯誤
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                status: false,
                message: "資料庫連接失敗，請稍後再試"
            });
        }
        
        // SQL語法錯誤
        if (error.name === 'QueryFailedError') {
            return res.status(400).json({
                status: false,
                message: "搜尋參數格式錯誤"
            });
        }
        
        // 其他未預期錯誤
        next(error);
    }
});

module.exports = router;