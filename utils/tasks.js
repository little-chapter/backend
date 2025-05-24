const { dataSource } = require("../db/data-source");

module.exports = cleanExpiredPendingOrders = async()=>{
    try{
        const now = new Date().toISOString();
        const result = await dataSource.getRepository("PendingOrders")
            .createQueryBuilder()
            .delete()
            .from("PendingOrders")
            .where("expired_at <=:expiredAt", {expiredAt: now})
            .execute();
        console.log(`Expired pending orders deleted: ${result.affected}`);
    }catch(error){
        console.error('Failed to clean expired pending orders:', error);
    }
}