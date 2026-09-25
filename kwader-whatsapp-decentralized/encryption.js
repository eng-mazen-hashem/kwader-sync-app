const crypto = require('crypto');

/**
 * Derives a consistent 32-byte key from any string secret
 * @param {string} secret 
 * @returns {Buffer} 32-byte buffer
 */
function deriveKey(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an object or string using AES-256-GCM
 * @param {any} data - Object or string to encrypt
 * @param {string} secretKey - Secret key string
 * @returns {string} Encrypted string in format "iv:authTag:ciphertext" (hex encoded)
 */
function encrypt(data, secretKey) {
    if (data === undefined || data === null) return '';
    const key = deriveKey(secretKey);
    const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string
 * @param {string} encryptedStr - Encrypted string "iv:authTag:ciphertext"
 * @param {string} secretKey - Secret key string
 * @returns {any} Decrypted object or string
 */
function decrypt(encryptedStr, secretKey) {
    if (!encryptedStr || typeof encryptedStr !== 'string') return null;
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted string format. Expected iv:authTag:ciphertext');
    }
    
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = deriveKey(secretKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = {
    deriveKey,
    encrypt,
    decrypt
};
