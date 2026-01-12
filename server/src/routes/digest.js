/**
 * Digest Routes - 简报生成 API
 * 
 * 提供订阅源/分组的 AI 简报生成功能
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { DigestStore } from '../utils/digest-store.js';
import { DigestService } from '../services/digest-service.js';
import { PreferenceStore } from '../utils/preference-store.js';

const router = express.Router();



/**
 * GET /api/digest/list
 * 获取简报列表（用于文章列表显示）
 */
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const { scope, scopeId, unreadOnly } = req.query;

        const options = {};
        if (scope) options.scope = scope;
        if (scopeId) options.scopeId = parseInt(scopeId);
        if (unreadOnly === 'true' || unreadOnly === '1') options.unreadOnly = true;

        // 支持 before 参数进行分页 (ISO 字符串或时间戳)
        const { before } = req.query;
        if (before) options.before = before;

        const userId = PreferenceStore.getUserId(req.user);
        const result = DigestStore.getForArticleList(userId, options);

        res.json({
            success: true,
            digests: result
        });
    } catch (error) {
        console.error('Get digest list error:', error);
        res.status(500).json({ error: '获取简报列表失败' });
    }
});

/**
 * GET /api/digest/:id
 * 获取单个简报详情
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = PreferenceStore.getUserId(req.user);
        const digest = DigestStore.get(userId, id);

        if (!digest) {
            return res.status(404).json({ error: '简报不存在' });
        }

        res.json({
            success: true,
            digest
        });
    } catch (error) {
        console.error('Get digest error:', error);
        res.status(500).json({ error: '获取简报失败' });
    }
});

/**
 * POST /api/digest/generate
 * 生成简报并存储
 */
router.post('/generate', authenticateToken, async (req, res) => {
    try {
        const {
            scope = 'all',
            feedId,
            groupId,
            hours = 12,
            targetLang = '简体中文',
            prompt: customPrompt,
            aiConfig
        } = req.body;

        const userId = PreferenceStore.getUserId(req.user);
        const prefs = PreferenceStore.get(userId);
        const storedAiConfig = prefs.ai_config || {};

        if (!storedAiConfig.apiKey) {
            return res.status(400).json({ error: 'AI service not configured' });
        }

        const result = await DigestService.generate(req.miniflux, userId, {
            scope,
            feedId,
            groupId,
            hours,
            targetLang,
            prompt: customPrompt,
            aiConfig: storedAiConfig
        });

        res.json(result);
    } catch (error) {
        console.error('Generate digest error:', error);
        res.status(500).json({ error: error.message || '生成简报失败' });
    }
});


/**
 * POST /api/digest/:id/read
 * 标记简报为已读
 */
router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = PreferenceStore.getUserId(req.user);
        const success = DigestStore.markAsRead(userId, id);

        if (!success) {
            return res.status(404).json({ error: '简报不存在' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark digest read error:', error);
        res.status(500).json({ error: '标记失败' });
    }
});

/**
 * DELETE /api/digest/:id/read
 * 标记简报为未读
 */
router.delete('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = PreferenceStore.getUserId(req.user);
        const success = DigestStore.markAsUnread(userId, id);

        if (!success) {
            return res.status(404).json({ error: '简报不存在' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark digest unread error:', error);
        res.status(500).json({ error: '标记失败' });
    }
});

/**
 * DELETE /api/digest/:id
 * 删除简报
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = PreferenceStore.getUserId(req.user);
        const success = DigestStore.delete(userId, id);

        if (!success) {
            return res.status(404).json({ error: '简报不存在' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete digest error:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

/**
 * GET /api/digest/preview
 * 预览可用于生成简报的文章
 */
router.get('/preview', authenticateToken, async (req, res) => {
    try {
        const {
            scope = 'all',
            feedId,
            groupId,
            hours = 12
        } = req.query;

        const options = { hours: parseInt(hours) };

        if (scope === 'feed' && feedId) {
            options.feedId = parseInt(feedId);
        } else if (scope === 'group' && groupId) {
            options.groupId = parseInt(groupId);
        }

        const articles = await getRecentUnreadArticles(req.miniflux, options);

        res.json({
            success: true,
            preview: {
                articleCount: articles.length,
                articles: articles.slice(0, 10).map(a => ({
                    id: a.id,
                    title: a.title,
                    feedTitle: a.feed ? a.feed.title : '',
                    publishedAt: a.published_at
                })),
                hours: parseInt(hours)
            }
        });

    } catch (error) {
        console.error('Preview digest error:', error);
        res.status(500).json({
            error: '预览失败'
        });
    }
});

export default router;
