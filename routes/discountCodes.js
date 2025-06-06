const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('DiscountCodes');
const { verifyToken } = require("../middlewares/auth");
const {isNotValidString, isNotValidInteger} = require("../utils/validUtils")
const { isUUID } = require("validator");

router.post("/:code", verifyToken, async(req, res, next) =>{
    try{
        const {id} = req.user;
        const {code} = req.params;
        const {totalAmount} = req.body;
        if(!id || !isUUID(id) || !code || isNotValidString(code) || !totalAmount || isNotValidInteger(Number(totalAmount)) || Number.isNaN(Number(totalAmount))){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
            return
        }
        const existCode = await dataSource.getRepository("DiscountCodes")
            .createQueryBuilder("code")
            .where("code.code =:codeName", {codeName: code})
            .getExists();
        if(!existCode){
            res.status(404).json({
                status: false,
                message: "找不到該折扣碼",
            });
            return
        }
        const now = new Date().toISOString();
        const validCode = await dataSource.getRepository("DiscountCodes")
            .createQueryBuilder("code")
            .select([
                "code.id AS id",
                "code.discount_type AS discount_type",
                "code.description AS description",
                "code.discount_value AS discount_value",
                "code.min_purchase AS min_purchase"
            ])
            .where("code.code =:codeName", {codeName: code})
            .andWhere("code.start_date <=:startDate", {startDate: now})
            .andWhere("code.end_date >=:endDate", {endDate: now})
            .andWhere("code.is_active =:isActived", {isActived: true})
            .getRawOne();
        if(!validCode){
            res.status(400).json({
                status: false,
                message: "無效的折扣碼",
            });
            return
        }
        if(validCode.min_purchase && Number(totalAmount) < Number(validCode.min_purchase)){
            res.status(409).json({
                status: false,
                message: `未達最低消費金額 ${parseInt(validCode.min_purchase)} 元`,
            });
            return
        }
        const codeUsage = await dataSource.getRepository("DiscountCodeUsages")
            .createQueryBuilder("usage")
            .where("usage.user_id =:userId", {userId: id})
            .andWhere("usage.code_id =:codeId", {codeId: validCode.id})
            .getRawOne();
        if(codeUsage){
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
    }catch(error){
        logger.error('兌換折扣碼錯誤:', error);
        next(error);
    }
})

module.exports = router;