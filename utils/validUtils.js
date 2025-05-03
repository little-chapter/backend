function isNotValidString (value) {
    return typeof value !== "string" || value.trim().length === 0 || value === ""
}
function isNotValidInteger (value) {
    return typeof value !== "number" || value < 0 || value % 1 !== 0
}
function isValidDateStr(dateStr){
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateStr);
}
function isValidEmail(emailStr){
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(emailStr)
}
module.exports = {
    isNotValidString,
    isNotValidInteger,
    isValidDateStr,
    isValidEmail,
}