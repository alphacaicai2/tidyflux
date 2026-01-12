/**
 * Digest Store - 简报持久化存储
 * 
 * 存储生成的简报，供文章列表显示
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DIGEST_DIR = path.join(DATA_DIR, 'digests');

// 确保目录存在
function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DIGEST_DIR)) {
        fs.mkdirSync(DIGEST_DIR, { recursive: true });
    }
}

// 获取日期字符串 (YYYY-MM-DD)
function getDateStr(date) {
    if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 从简报 ID 中提取日期字符串
// ID 格式: digest_TIMESTAMP_RANDOM
function getDateStrFromId(id) {
    try {
        const parts = id.split('_');
        if (parts.length >= 2) {
            const timestamp = parseInt(parts[1]);
            if (!isNaN(timestamp)) {
                return getDateStr(timestamp);
            }
        }
    } catch (e) {
        console.error('Parse date from ID error:', e);
    }
    return null;
}

// 获取用户简报文件路径 (按日期)
function getUserDigestFile(userId, dateStr) {
    ensureDir();
    return path.join(DIGEST_DIR, `${userId}_${dateStr}.json`);
}

// 加载指定日期的简报
function loadDigestsForDate(userId, dateStr) {
    const file = getUserDigestFile(userId, dateStr);
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error(`Load digests for ${dateStr} error:`, e);
    }
    return [];
}

// 保存指定日期的简报
function saveDigestsForDate(userId, dateStr, digests) {
    const file = getUserDigestFile(userId, dateStr);
    try {
        fs.writeFileSync(file, JSON.stringify(digests, null, 2), 'utf8');
    } catch (e) {
        console.error(`Save digests for ${dateStr} error:`, e);
    }
}

/**
 * 加载最近的简报 (支持分页/游标)
 * @param {string} userId - 用户ID
 * @param {number} limit - 限制数量
 * @param {string|null} before - 加载该时间之前的简报 (ISO 字符串或时间戳)
 */
function loadRecentUserDigests(userId, limit = 50, before = null) {
    ensureDir();
    let allDigests = [];
    let beforeDate = before ? new Date(before) : new Date(); // 默认为当前时间
    if (isNaN(beforeDate.getTime())) beforeDate = new Date();

    // 如果没有传 before，稍微延迟一点当前时间，确保包含刚生成的（以防毫秒级差异）
    if (!before) {
        beforeDate = new Date(Date.now() + 1000);
    }

    const beforeDateStr = getDateStr(beforeDate);
    const beforeTimestamp = beforeDate.getTime();

    try {
        const files = fs.readdirSync(DIGEST_DIR);
        // 匹配 userId_YYYY-MM-DD.json
        const regex = new RegExp(`^${userId}_(\\d{4}-\\d{2}-\\d{2})\\.json$`);

        // 筛选属于该用户的文件
        const userFiles = files.filter(f => regex.test(f));

        // 按文件名倒序排序 (日期越新越靠前)
        userFiles.sort().reverse();

        for (const file of userFiles) {
            // 提取文件名中的日期
            const match = file.match(regex);
            if (!match) continue;
            const fileDateStr = match[1];

            // 1. 如果文件日期比 beforeDate 还要晚，直接跳过整个文件
            if (fileDateStr > beforeDateStr) continue;

            try {
                let content = JSON.parse(fs.readFileSync(path.join(DIGEST_DIR, file), 'utf8'));

                // 2. 如果文件日期就是 cutoff 这一天，我们需要在内容级别进行过滤
                if (fileDateStr === beforeDateStr) {
                    content = content.filter(d => new Date(d.generatedAt).getTime() < beforeTimestamp);
                }

                // 3. 将符合条件的内容加入总列表
                // content 本身通常已经是倒序的（最新在前），直接 concat 即可
                allDigests = allDigests.concat(content);

                // 4. 检查数量是否达标
                if (allDigests.length >= limit) break;

            } catch (e) {
                console.error(`Error reading ${file}:`, e);
            }
        }

    } catch (e) {
        console.error('Load recent digests error:', e);
    }

    // 再次按时间排序确保严格倒序
    allDigests.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

    // 切片返回限制数量 (这里可以切片，因为已经按 before 过滤过了，确实只需要返回接下来的 limit 个)
    return allDigests.slice(0, limit);
}

// 生成简报 ID (支持传入时间戳以保持一致性)
function generateDigestId(timestamp = Date.now()) {
    return `digest_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
}

export const DigestStore = {
    /**
     * 获取所有简报 (内部核心查询方法)
     * @param {string} userId 
     * @param {Object} options { scope, scopeId, unreadOnly, limit, before }
     */
    getAll(userId, options = {}) {
        const { scope, scopeId, unreadOnly = false, limit = 100, before = null } = options;

        // 加载数据 (核心改动：透传 before 参数)
        // 注意：这里的 limit 是为了限制文件读取范围，我们稍微多读一点点以防过滤后不够
        // 但其实 loadRecentUserDigests 内部已经做好了逻辑，直接传 limit 即可
        let digests = loadRecentUserDigests(userId, limit, before);

        // 按 scope 筛选
        if (scope && scopeId) {
            digests = digests.filter(d => d.scope === scope && d.scopeId == scopeId);
        } else if (scope === 'all') {
            digests = digests.filter(d => d.scope === 'all');
        }

        // 只显示未读
        if (unreadOnly) {
            digests = digests.filter(d => !d.isRead);
        }

        return digests;
    },

    /**
     * 获取单个简报 (优化：直接根据ID定位文件)
     */
    get(userId, digestId) {
        // 尝试从 ID 解析日期
        const dateStr = getDateStrFromId(digestId);

        if (dateStr) {
            // 直接读取对应日期的文件
            const digests = loadDigestsForDate(userId, dateStr);
            const digest = digests.find(d => d.id === digestId);
            if (digest) return digest;
        }

        // 回退机制
        console.warn(`Fast lookup failed for ${digestId}, falling back to recent scan`);
        const recent = loadRecentUserDigests(userId, 200);
        return recent.find(d => d.id === digestId) || null;
    },

    /**
     * 添加简报
     */
    add(userId, digestData) {
        const now = new Date(digestData.generatedAt || Date.now());
        const timestamp = now.getTime();
        const dateStr = getDateStr(now);

        // 加载当天的简报
        const dayDigests = loadDigestsForDate(userId, dateStr);

        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${month}-${day}-${hours}:${minutes}`;

        // 使用相同的时间戳生成 ID
        const id = generateDigestId(timestamp);

        const digest = {
            id: id,
            type: 'digest',
            scope: digestData.scope || 'all',
            scopeId: digestData.scopeId || null,
            scopeName: digestData.scopeName || '全部订阅',
            title: digestData.title || `${digestData.scopeName || '全部'} · 简报 ${timeStr}`,
            content: digestData.content,
            articleCount: digestData.articleCount || 0,
            hours: digestData.hours || 12,
            generatedAt: digestData.generatedAt || now.toISOString(),
            isRead: false
        };

        dayDigests.unshift(digest);
        saveDigestsForDate(userId, dateStr, dayDigests);

        return digest;
    },

    /**
     * 更新简报状态 (通用方法)
     */
    _updateDigestStatus(userId, digestId, updates) {
        const dateStr = getDateStrFromId(digestId);
        if (!dateStr) return false;

        const dayDigests = loadDigestsForDate(userId, dateStr);
        const targetIndex = dayDigests.findIndex(d => d.id === digestId);

        if (targetIndex !== -1) {
            Object.assign(dayDigests[targetIndex], updates);
            saveDigestsForDate(userId, dateStr, dayDigests);
            return true;
        }
        return false;
    },

    markAsRead(userId, digestId) {
        return this._updateDigestStatus(userId, digestId, { isRead: true });
    },

    markAsUnread(userId, digestId) {
        return this._updateDigestStatus(userId, digestId, { isRead: false });
    },

    delete(userId, digestId) {
        const dateStr = getDateStrFromId(digestId);
        if (!dateStr) return false;

        const dayDigests = loadDigestsForDate(userId, dateStr);
        const index = dayDigests.findIndex(d => d.id === digestId);

        if (index !== -1) {
            dayDigests.splice(index, 1);
            saveDigestsForDate(userId, dateStr, dayDigests);
            return true;
        }
        return false;
    },

    /**
     * 获取用于文章列表的简报
     */
    getForArticleList(userId, options = {}) {
        // 默认限制 100
        const limit = options.limit || 100;
        const digests = this.getAll(userId, { ...options, limit });

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 分离今日未读和其他简报
        const todayUnread = [];
        const others = [];

        digests.forEach(d => {
            const digestDate = new Date(d.generatedAt);
            const isToday = digestDate >= today;


            // 只有当查询"最近"(没有指定before)且简报是今日生成的，才考虑置顶
            // 如果用户在翻旧历史(options.before存在)，就不应该再去置顶"今日"的了(逻辑上也不应该加载出来)
            const shouldPin = isToday && !options.before && !d.isRead;

            if (shouldPin) {
                todayUnread.push(d);
            } else if (!options.unreadOnly || !d.isRead) {
                others.push(d);
            }
        });

        // 格式化函数
        const toArticleFormat = (digest) => ({
            id: digest.id,
            type: 'digest',
            feed_id: null,
            title: digest.title,
            content: digest.content,
            published_at: digest.generatedAt,
            is_read: digest.isRead ? 1 : 0,
            is_favorited: 0,
            thumbnail_url: null,
            feed_title: digest.scopeName,
            author: 'AI',
            url: null,
            digest_scope: digest.scope,
            digest_scope_id: digest.scopeId,
            article_count: digest.articleCount
        });

        return {
            pinned: todayUnread.map(toArticleFormat),
            normal: others.map(toArticleFormat)
        };
    }
};
