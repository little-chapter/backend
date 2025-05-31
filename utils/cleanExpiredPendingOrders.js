const { dataSource } = require("../db/data-source");
const logger = require('../utils/logger')('CRON');

async function cleanExpiredPendingOrders(){
    try {
        const now = new Date().toISOString();
        const result = await dataSource.getRepository("PendingOrders")
            .createQueryBuilder("pendingOrders")
            .delete()
            .where("status =:status", { status: "pending" })
            .andWhere("expired_at <:now", { now })
            .execute();
        logger.info(`Expired pending orders cleaned: ${result.affected}`);
    } catch (err) {
        logger.warn("Failed to clean expired pending orders:", err);
    }
}
module.exports = {
    cleanExpiredPendingOrders,
}