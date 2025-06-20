const express = require("express");
const router = express.Router();
const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('Notifications');
const { verifyToken } = require("../middlewares/auth");
const {isNotValidInteger} = require("../utils/validUtils")
const {isUUID } = require("validator");

//取得所有通知
router.get("/", verifyToken, async(req, res, next) =>{
    try{
        const {id} = req.user;
        const allowedFilters = {
            page : "number",
            limit: "number",
            read: "boolean"
        }
        const filters = req.query;
        for(const key of Object.keys(filters)){
            if(!(key in allowedFilters)){
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
            if(expectedType === "boolean"){
                if(!value || !(value === "true" || value === "false")){
                    res.status(400).json({
                        status: false,
                        message: "欄位資料格式不符",
                    });
                    return
                }
            }
        }
        if(!id || !isUUID(id)){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
            return
        }
        const existUser = await dataSource.getRepository("User")
            .createQueryBuilder("user")
            .where("user.id =:userId", {userId: id})
            .getExists();
        if(!existUser){
            res.status(404).json({
                status: false,
                message: "找不到此用戶",
            });
            return
        }
        let notificationQuery = dataSource.getRepository("Notifications")
            .createQueryBuilder("notifications")
            .select([
                "id",
                "title",
                "content",
                "notification_type",
                "is_read",
                "created_at"
            ])
            .where("user_id =:userId", {userId: id})
            .andWhere("is_deleted =:isDeleted", {isDeleted: false})
        if(filters.read){
            const read = filters.read === "true" ? true : false;
            notificationQuery = notificationQuery
                .andWhere("is_read =:isRead", {isRead: read})
        }
        notificationQuery = notificationQuery
            .orderBy("created_at", "DESC")
        const countQuery = notificationQuery.clone();
        const count = await countQuery.getCount();
        let page = 1;
        let limit = 5;
        if(filters.page && Number(filters.page) > 1){
            page = Number(filters.page);
        }
        if(filters.limit && Number(filters.limit) >= 1){
            limit = Number(filters.limit)
        }
        let totalPages = Math.max(1, Math.ceil(count / limit));
        if(page > totalPages){
            page = totalPages
        }
        const skip = (page - 1) * limit;
        const notificationData = await notificationQuery
            .offset(skip)
            .limit(limit)
            .getRawMany();
        const notificationResult = notificationData.map(data =>{
            return {
                id: data.id,
                title: data.title,
                content: data.content,
                isRead: data.is_read,
                type: data.notification_type,
                createdAt: data.created_at
            }
        })
        res.status(200).json({
            status: true,
            data: notificationResult,
            pagination: {
                page: page,
                limit: limit,
                total: count,
                totalPages: totalPages
            }
        })
    }catch(error){
        logger.error('取得個人通知錯誤:', error);
        next(error);
    }
})
//標記通知為已讀
router.put("/read", verifyToken, async(req, res, next) =>{
    try{
        const {id} = req.user;
        let {confirm, notificationId} = req.body;
        if(!id || !isUUID(id) || typeof confirm !== "boolean"){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
            return
        }
        if(notificationId && (isNotValidInteger(Number(notificationId)) || Number.isNaN(Number(notificationId)))){
            res.status(400).json({
                status: false,
                message: "欄位資料格式不符",
            });
            return
        }
        if(confirm !== true){
            res.status(400).json({
                status: false,
                message: "未確認執行全部已讀",
            });
            return
        }
        const existUser = await dataSource.getRepository("User")
            .createQueryBuilder("user")
            .where("id =:userId", {userId: id})
            .getExists();
        if(!existUser){
            res.status(404).json({
                status: false,
                message: "找不到此用戶",
            });
            return
        }
        if(notificationId){
            const existNotification = await dataSource.getRepository("Notifications").findOneBy({id: notificationId});
            if(!existNotification){
                res.status(404).json({
                    status: false,
                    message: "找不到此通知",
                });
                return
            }
            const updatedNotifications = await dataSource.getRepository("Notifications")
                .createQueryBuilder("notifications")
                .update()
                .set({
                    is_read: true
                })
                .where("is_read =:isRead", {isRead: false})
                .andWhere("user_id =:userId", {userId: id})
                .andWhere("id =:id", {id: notificationId})
                .execute();
            if(updatedNotifications.affected === 0){
                res.status(200).json({
                    status: true,
                    message: "沒有未讀的通知",
                });
                return
            }
            res.status(200).json({
                status: true,
                message: "已將通知標記為已讀",
                updatedCount: updatedNotifications.affected
            })
        }else{
            const updatedNotifications = await dataSource.getRepository("Notifications")
                .createQueryBuilder("notifications")
                .update()
                .set({
                    is_read: true
                })
                .where("is_read =:isRead", {isRead: false})
                .andWhere("user_id =:userId", {userId: id})
                .execute();
            if(updatedNotifications.affected === 0){
                res.status(200).json({
                    status: true,
                    message: "沒有未讀的通知",
                });
                return
            }
            res.status(200).json({
                status: true,
                message: "已將通知標記為已讀",
                updatedCount: updatedNotifications.affected
            })
        }
    }catch(error){
        logger.error('已讀所有通知錯誤:', error);
        next(error);
    }
})

module.exports = router;