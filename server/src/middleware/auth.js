import jwt from 'jsonwebtoken';
import { MinifluxClient } from '../miniflux.js';
import { MinifluxConfigStore } from '../utils/miniflux-config-store.js';

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set in environment variables. Using a random secret. Sessions will be invalidated on server restart.');
}

// 缓存 MinifluxClient 单例实例
let minifluxClientInstance = null;
let lastConfigHash = null;

function getConfigHash(config) {
    if (!config) return null;
    return `${config.url}:${config.username}:${config.password}:${config.apiKey}`;
}

export function getMinifluxClient() {
    const config = MinifluxConfigStore.getConfig();
    const currentHash = getConfigHash(config);

    // 如果配置变化了，需要重新创建实例
    if (currentHash !== lastConfigHash) {
        minifluxClientInstance = null;
        lastConfigHash = currentHash;
    }

    if (!minifluxClientInstance && config) {
        minifluxClientInstance = new MinifluxClient(
            config.url,
            config.username,
            config.password,
            config.apiKey
        );
    }
    return minifluxClientInstance;
}

// 清除缓存的客户端实例（配置更新时调用）
export function clearMinifluxClientCache() {
    minifluxClientInstance = null;
    lastConfigHash = null;
}

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未登录' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '登录已过期' });
        }
        req.user = user;

        // 使用缓存的 MinifluxClient 实例
        req.miniflux = getMinifluxClient();
        if (!req.miniflux) {
            console.warn('Miniflux environment variables are missing!');
        }

        next();
    });
}

export function generateToken(payload) {
    return jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export { JWT_SECRET };
