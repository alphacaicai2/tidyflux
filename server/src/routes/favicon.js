import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MinifluxClient } from '../miniflux.js';
import { MinifluxConfigStore } from '../utils/miniflux-config-store.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 缓存目录
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache', 'favicons');
const WWW_DIR = path.join(process.cwd(), '../www'); // 前端静态文件目录

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 缓存有效期（7天）
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// 获取 Miniflux 客户端
function getMinifluxClient() {
    const config = MinifluxConfigStore.getConfig();

    if (!config) {
        return null;
    }

    return new MinifluxClient(config.url, config.username, config.password, config.apiKey);
}

/**
 * 获取订阅源图标（使用 Miniflux API）
 * GET /api/favicon?feedId=123
 */
router.get('/', async (req, res) => {
    try {
        const { feedId } = req.query;

        // 如果没有 feedId，直接返回默认
        if (!feedId) {
            return serveDefaultIcon(res, 600); // 10分钟缓存
        }

        // 缓存文件路径（使用 feedId 作为 key）
        const cacheFile = path.join(CACHE_DIR, `feed_${feedId}.png`);
        const cacheMetaFile = path.join(CACHE_DIR, `feed_${feedId}.json`);

        // 检查缓存是否存在且有效
        if (fs.existsSync(cacheFile) && fs.existsSync(cacheMetaFile)) {
            try {
                const meta = JSON.parse(fs.readFileSync(cacheMetaFile, 'utf8'));
                const age = Date.now() - meta.timestamp;

                if (age < CACHE_MAX_AGE) {
                    // 缓存有效，直接返回
                    res.set('Content-Type', meta.mime_type || 'image/png');
                    res.set('Cache-Control', 'public, max-age=604800'); // 7天
                    res.set('X-Cache', 'HIT');
                    return res.send(fs.readFileSync(cacheFile));
                }
            } catch (e) {
                // 缓存元数据损坏，忽略，尝试获取新的
            }
        }

        // 获取 Miniflux 客户端
        const miniflux = getMinifluxClient();
        if (!miniflux) {
            // 未配置，直接返回默认
            return serveDefaultIcon(res, 600);
        }

        try {
            // 从 Miniflux 获取图标
            // Miniflux API 返回: { id, data (base64), mime_type }
            const iconData = await miniflux.request(`/feeds/${feedId}/icon`);

            if (!iconData || !iconData.data) {
                throw new Error('No icon data');
            }

            // 解码 Base64 数据
            let base64Data = iconData.data;
            let mimeType = iconData.mime_type || 'image/png';

            // 如果是 Data URL 格式，提取真正的 base64 数据
            if (base64Data.includes(';base64,')) {
                const parts = base64Data.split(';base64,');
                mimeType = parts[0].replace(/^data:/, '');
                base64Data = parts[1];
            }

            const imageBuffer = Buffer.from(base64Data, 'base64');

            // 保存到缓存
            fs.writeFileSync(cacheFile, imageBuffer);
            fs.writeFileSync(cacheMetaFile, JSON.stringify({
                timestamp: Date.now(),
                feedId: feedId,
                mime_type: mimeType
            }));

            res.set('Content-Type', mimeType);
            res.set('Cache-Control', 'public, max-age=604800'); // 7天
            res.set('X-Cache', 'MISS');
            res.send(imageBuffer);
        } catch (fetchError) {
            // 获取失败（通常是 404 该源无图标）

            // 如果有旧缓存（即使过期），优先返回旧缓存（更好地降级体验）
            if (fs.existsSync(cacheFile)) {
                try {
                    const meta = fs.existsSync(cacheMetaFile)
                        ? JSON.parse(fs.readFileSync(cacheMetaFile, 'utf8'))
                        : {};
                    res.set('Content-Type', meta.mime_type || 'image/png');
                    res.set('Cache-Control', 'public, max-age=604800');
                    res.set('X-Cache', 'STALE');
                    return res.send(fs.readFileSync(cacheFile));
                } catch (e) {
                    // 读取旧缓存失败
                }
            }

            // 没有旧缓存，返回默认图标 (缓存 10 分钟，以便后续重试)
            return serveDefaultIcon(res, 600);
        }
    } catch (error) {
        console.error('Favicon error:', error);
        // 服务器内部错误，也返回默认图标，防止前端报错闪烁
        return serveDefaultIcon(res, 600);
    }
});

// 辅助函数：返回默认图标
function serveDefaultIcon(res, maxAge = 604800) {
    const defaultIconPath = path.join(WWW_DIR, 'icons', 'rss.svg');
    if (fs.existsSync(defaultIconPath)) {
        res.set('Content-Type', 'image/svg+xml');
        res.set('Cache-Control', `public, max-age=${maxAge}`);
        res.set('X-Cache', 'DEFAULT');
        res.sendFile(defaultIconPath);
    } else {
        // 连默认图标都没有，只能返回 404
        res.status(404).end();
    }
}

export default router;
