const crypto = require('crypto');

function encryptAES(data, hashKey, hashIV) {
    const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptAES(encryptedData, hashKey, hashIV) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const result = decrypted.replace(/[\x00-\x20]+/g, '');
    return JSON.parse(result);
}

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
    encryptAES,
    decryptAES,
    sha256,
}