/**
 * Miniflux 配置存储模块
 * 支持环境变量配置或手动配置
 * 密码使用 AES-256-GCM 加密存储
 */
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt } from './encryption.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'miniflux-config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = JSON.parse(data);

            // 解密密码
            if (config.encryptedPassword) {
                config.password = decrypt(config.encryptedPassword);
                delete config.encryptedPassword;
            }

            // 解密 API Key
            if (config.encryptedApiKey) {
                config.apiKey = decrypt(config.encryptedApiKey);
                delete config.encryptedApiKey;
            }

            return config;
        }
    } catch (error) {
        console.error('Error loading miniflux config:', error);
    }
    return null;
}

function saveConfig(url, username, password, apiKey = null, authType = 'basic') {
    try {
        const config = {
            url,
            username,
            encryptedPassword: password ? encrypt(password) : null,
            encryptedApiKey: apiKey ? encrypt(apiKey) : null,
            authType: authType || 'basic', // 'basic' or 'api_key'
            updated_at: new Date().toISOString()
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving miniflux config:', error);
        return false;
    }
}

export const MinifluxConfigStore = {
    /**
     * 检查是否已通过环境变量配置
     */
    isEnvConfigured() {
        const hasUrl = !!process.env.MINIFLUX_URL;
        const hasApiKey = !!process.env.MINIFLUX_API_KEY;
        const hasBasic = !!(process.env.MINIFLUX_USERNAME && process.env.MINIFLUX_PASSWORD);
        return hasUrl && (hasApiKey || hasBasic);
    },

    /**
     * 检查是否已手动配置
     */
    isManualConfigured() {
        const config = loadConfig();
        if (!config || !config.url) return false;

        if (config.authType === 'api_key') {
            return !!config.apiKey;
        }

        // Default to checking username/password if not api_key explicit or fallback
        return !!(config.username && config.password);
    },

    /**
     * 获取有效的 Miniflux 配置
     * 优先使用环境变量，其次使用手动配置
     */
    getConfig() {
        // 优先使用环境变量
        if (this.isEnvConfigured()) {
            if (process.env.MINIFLUX_API_KEY) {
                return {
                    url: process.env.MINIFLUX_URL,
                    apiKey: process.env.MINIFLUX_API_KEY,
                    authType: 'api_key',
                    source: 'env'
                };
            }
            return {
                url: process.env.MINIFLUX_URL,
                username: process.env.MINIFLUX_USERNAME,
                password: process.env.MINIFLUX_PASSWORD,
                authType: 'basic',
                source: 'env'
            };
        }

        // 其次使用手动配置
        const config = loadConfig();
        if (config && config.url) {
            if (config.authType === 'api_key' && config.apiKey) {
                return {
                    url: config.url,
                    apiKey: config.apiKey,
                    authType: 'api_key',
                    source: 'manual'
                };
            } else if (config.username && config.password) {
                return {
                    url: config.url,
                    username: config.username,
                    password: config.password,
                    authType: 'basic',
                    source: 'manual'
                };
            }
        }

        return null;
    },

    /**
     * 获取安全的配置信息（不包含密码）
     */
    getSafeConfig() {
        const config = this.getConfig();
        if (config) {
            return {
                configured: true,
                url: config.url,
                username: config.username,
                authType: config.authType,
                apiKey: config.authType === 'api_key' ? '********' : null,
                source: config.source
            };
        }
        return {
            configured: false,
            url: null,
            username: null,
            authType: null,
            source: null
        };
    },

    /**
     * 保存手动配置（密码/Key会加密存储）
     */
    saveManualConfig(url, username, password, apiKey, authType) {
        return saveConfig(url, username, password, apiKey, authType);
    },

    /**
     * 清除手动配置
     */
    clearManualConfig() {
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                fs.unlinkSync(CONFIG_FILE);
                return true;
            } catch (error) {
                console.error('Error clearing miniflux config:', error);
                return false;
            }
        }
        return true;
    }
};
