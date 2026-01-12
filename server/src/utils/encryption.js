import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const KEY_FILE = path.join(DATA_DIR, '.encryption-key');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 获取或生成加密密钥
function getEncryptionKey() {
    if (fs.existsSync(KEY_FILE)) {
        return fs.readFileSync(KEY_FILE, 'utf8').trim();
    }
    // 生成新的 256 位密钥
    const key = crypto.randomBytes(32).toString('hex');
    try {
        fs.writeFileSync(KEY_FILE, key, { mode: 0o600 }); // 只有所有者可读写
    } catch (error) {
        console.error('Error writing encryption key:', error);
        throw new Error('Failed to persist encryption key. Cannot proceed safely.');
    }
    return key;
}

// 加密
export function encrypt(text) {
    if (!text) return null;
    try {
        const key = Buffer.from(getEncryptionKey(), 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            data: encrypted
        };
    } catch (error) {
        console.error('Encryption failed:', error);
        return null;
    }
}

// 解密
export function decrypt(encrypted) {
    if (!encrypted) return null;
    try {
        const key = Buffer.from(getEncryptionKey(), 'hex');
        const iv = Buffer.from(encrypted.iv, 'hex');
        const authTag = Buffer.from(encrypted.authTag, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
}
