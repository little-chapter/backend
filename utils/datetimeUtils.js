const { DateTime } = require("luxon");

function addOneDayToUtc(utcString) {
    const utcDate = DateTime.fromISO(utcString, { zone: 'utc' });
    const oneDayLater = utcDate.plus({ days: 1 }); // 增加一天
    return oneDayLater.toISO(); // 轉換回 ISO 8601 UTC 字串
}
module.exports = {
    addOneDayToUtc,
}