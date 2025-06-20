const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('DiscountCodes');
const { verifyToken } = require("../middlewares/auth");
const { isNotValidString, isNotValidInteger } = require("../utils/validUtils")
const { isUUID } = require("validator");

// 取得折扣碼列表
router.get("/", verifyToken, async (req, res) => {
    try {
        const now = new Date();
        const userId = req.user.id;

        const discountCodesRepo = dataSource.getRepository("discountCodes");

        const rawList = await discountCodesRepo
            .createQueryBuilder("dc")
            .leftJoin(
                "discountCodeUsages",                   // 你的使用紀錄表
                "dcu",                                   // alias
                "dcu.code_id = dc.id AND dcu.user_id = :userId",
                { userId }
            )
            .select([
                "dc.id AS id",
                "dc.code AS code",
                "dc.description AS description",
                "dc.discount_type AS discount_type",
                "dc.discount_value AS discount_value",
                "dc.start_date AS start_date",
                "dc.end_date AS end_date",
                "dc.used_count AS used_count",
                "dc.min_purchase AS min_purchase",
            ])
            .addSelect(
                `CASE WHEN dcu.id IS NOT NULL THEN TRUE ELSE FALSE END`,
                "is_used"
            )
            .where("dc.is_active = :isActive", { isActive: true })
            .andWhere("dc.start_date <= :now", { now })
            .andWhere("dc.end_date >= :now", { now })
            .orderBy("dc.start_date", "ASC")
            .getRawMany();

        console.log(typeof rawList[0])
        console.log(rawList[0]);
        const responseData = rawList.map((item) => ({
            id: item.id,
            code: item.code,
            description: item.description,
            discountType: item.discount_type,
            discountValue: parseFloat(item.discount_value),
            startDate: item.start_date.toISOString(),
            endDate: item.end_date.toISOString(),
            isUsed: item.is_used === true || item.is_used === "true",
        }));

        return res.status(200).json({
            status: true,
            data: responseData,
        });
    } catch (error) {
        logger.error("取得折扣碼列表失敗：", error);
        return res.status(500).json({
            status: false,
            message: "伺服器錯誤，請稍後再試",
        });
    }
});


// 兌換折扣碼
router.post("/:code", verifyToken, async (req, res, next) => {
    try {
        const { id } = req.user;
        const { code } = req.params;
        const { totalAmount } = req.body;
        if (!id || !isUUID(id) || !code || isNotValidString(code) || !totalAmount || isNotValidInteger(Number(totalAmount)) || Number.isNaN(Number(totalAmount))) {
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
            return
        }
        const existCode = await dataSource.getRepository("DiscountCodes")
            .createQueryBuilder("code")
            .where("code =:codeName", { codeName: code })
            .getExists();
        if (!existCode) {
            res.status(404).json({
                status: false,
                message: "找不到該折扣碼",
            });
            return
        }
        const now = new Date();
        const validCode = await dataSource.getRepository("DiscountCodes")
            .createQueryBuilder("code")
            .select([
                "id",
                "discount_type",
                "description",
                "discount_value",
                "min_purchase"
            ])
            .where("code =:codeName", { codeName: code })
            .andWhere("start_date <=:startDate", { startDate: now })
            .andWhere("end_date >=:endDate", { endDate: now })
            .andWhere("is_active =:isActived", { isActived: true })
            .getRawOne();
        if (!validCode) {
            res.status(400).json({
                status: false,
                message: "無效的折扣碼",
            });
            return
        }
        if (validCode.min_purchase && Number(totalAmount) < Number(validCode.min_purchase)) {
            res.status(409).json({
                status: false,
                message: `未達最低消費金額 ${parseInt(validCode.min_purchase)} 元`,
            });
            return
        }
        const codeUsage = await dataSource.getRepository("DiscountCodeUsages")
            .createQueryBuilder("usage")
            .where("user_id =:userId", { userId: id })
            .andWhere("code_id =:codeId", { codeId: validCode.id })
            .getRawOne();
        if (codeUsage) {
            res.status(409).json({
                status: false,
                message: "已使用此折扣碼",
            });
            return
        }
        res.status(200).json({
            status: true,
            message: {
                discountCode: code,
                description: validCode.description,
                discountType: validCode.discount_type,
                discountAmount: validCode.discount_type === "fixed" ? Number(validCode.discount_value) : totalAmount * Number(validCode.discount_value)
            }
        })
    } catch (error) {
        logger.error('兌換折扣碼錯誤:', error);
        next(error);
    }
})

module.exports = router;