import fs from 'fs';
import path from 'path';
import { encrypt, decrypt } from './encryption.js';

// 获取数据目录路径
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PREFERENCES_DIR = path.join(DATA_DIR, 'preferences');

// 确保目录存在
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// 获取用户偏好设置文件路径
function getUserPrefsPath(userId) {
    ensureDir(PREFERENCES_DIR);
    return path.join(PREFERENCES_DIR, `${userId}.json`);
}

export const PreferenceStore = {
    // 读取用户偏好设置
    get(userId) {
        const filePath = getUserPrefsPath(userId);
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                const prefs = JSON.parse(data);

                // 解密 AI API Key
                if (prefs.ai_config && prefs.ai_config.encryptedApiKey) {
                    const decryptedKey = decrypt(prefs.ai_config.encryptedApiKey);
                    if (decryptedKey) {
                        prefs.ai_config.apiKey = decryptedKey;
                    }
                    delete prefs.ai_config.encryptedApiKey;
                }

                return prefs;
            }
        } catch (error) {
            console.error(`Error loading preferences for ${userId}:`, error);
        }
        return {};
    },

    // 保存用户偏好设置
    save(userId, prefs) {
        const filePath = getUserPrefsPath(userId);
        try {
            // 克隆对象以避免修改引用
            const prefsToSave = JSON.parse(JSON.stringify(prefs));

            // 加密 AI API Key
            if (prefsToSave.ai_config && prefsToSave.ai_config.apiKey) {
                const encrypted = encrypt(prefsToSave.ai_config.apiKey);
                if (encrypted) {
                    prefsToSave.ai_config.encryptedApiKey = encrypted;
                    delete prefsToSave.ai_config.apiKey;
                }
            }

            fs.writeFileSync(filePath, JSON.stringify(prefsToSave, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`Error saving preferences for ${userId}:`, error);
            return false;
        }
    },

    // 获取所有用户的 ID 列表（用于遍历任务）
    getAllUserIds() {
        try {
            ensureDir(PREFERENCES_DIR);
            const files = fs.readdirSync(PREFERENCES_DIR);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
        } catch (error) {
            console.error('Error getting all user IDs:', error);
            return [];
        }
    },

    // 生成用户唯一 ID（基于 Miniflux 用户名）
    getUserId(user) {
        const username = user.miniflux_username || user.username || 'default';
        return Buffer.from(username).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    }
};
