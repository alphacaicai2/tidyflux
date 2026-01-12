/**
 * Digest View - 简报视图
 * 
 * 提供简报生成功能
 */

import { i18n } from '../i18n.js';
import { AuthManager } from '../auth-manager.js';
import { AIService } from '../ai-service.js';
import { showToast } from './utils.js';
import { Modal } from './components.js';
import { Dialogs } from './dialogs.js';

/**
 * 简报视图管理
 */
export const DigestView = {
    viewManager: null,

    /**
     * 初始化简报视图
     * @param {Object} viewManager - ViewManager 实例引用
     */
    init(viewManager) {
        this.viewManager = viewManager;
    },

    /**
     * 生成简报
     * @param {string} scope - 'all' | 'feed' | 'group'
     * @param {number} feedId - 订阅源 ID
     * @param {number} groupId - 分组 ID
     */
    async generate(scope = 'all', feedId = null, groupId = null) {
        // 检查 AI 配置
        if (!AIService.isConfigured()) {
            await Modal.alertWithSettings(i18n.t('digest.ai_not_configured'), i18n.t('common.go_to_settings'), () => Dialogs.showSettingsDialog(false));
            return;
        }

        // 显示生成中的提示
        showToast(i18n.t('digest.generating'), 30000, true);

        try {
            const aiConfig = AIService.getConfig();
            const token = AuthManager.getToken();

            const response = await AuthManager.fetchWithAuth('/api/digest/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scope,
                    feedId,
                    groupId,
                    hours: 12,
                    targetLang: AIService.getLanguageName(aiConfig.targetLang || 'zh-CN'),
                    prompt: aiConfig.digestPrompt,
                    // aiConfig is now loaded from server side for security and consistency
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || i18n.t('digest.error'));
            }

            // 隐藏加载提示
            showToast(i18n.t('digest.generated') || '简报生成成功', 2000, false);

            // 将新简报添加到列表并跳转
            if (data.digest && data.digest.id) {
                // ... (existing code for success) 
                // 导入 AppState
                const { AppState } = await import('../../state.js');

                // 清空文章列表，这样返回时会重新加载（包含新简报）
                AppState.articles = [];

                // 构建带上下文的跳转链接
                const params = new URLSearchParams();
                if (feedId) params.set('feed', feedId);
                if (groupId) params.set('group', groupId);
                const queryString = params.toString();
                const hash = queryString
                    ? `#/article/${data.digest.id}?${queryString}`
                    : `#/article/${data.digest.id}`;

                // 跳转到简报详情页
                window.location.hash = hash;
            } else {
                // 没有生成的简报（通常是因为没有未读文章）
                showToast(data.digest?.content || i18n.t('digest.no_articles') || '该时间段内没有未读文章', 3000, false);
            }

        } catch (error) {
            console.error('Generate digest error:', error);
            await Modal.alert(error.message || i18n.t('digest.error'));
        }
    },

    /**
     * 为订阅源生成简报
     */
    generateForFeed(feedId) {
        this.generate('feed', feedId, null);
    },

    /**
     * 为分组生成简报
     */
    generateForGroup(groupId) {
        this.generate('group', null, groupId);
    },

    /**
     * 生成全部简报
     */
    generateAll() {
        this.generate('all', null, null);
    }
};
