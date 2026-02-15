/**
 * Digest View - 简报视图
 * 
 * 提供简报生成功能
 */

import { i18n } from '../i18n.js';
import { AuthManager } from '../auth-manager.js';
import { AIService } from '../ai-service.js';
import { AppState } from '../../state.js';
import { showToast, createDialog } from './utils.js';
import { Modal } from './components.js';
import { Dialogs } from './dialogs.js';
import { Icons } from '../icons.js';

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
     * @param {number} hours - 时间范围（小时），0 表示所有文章；12/24/72/168 对应 12h/24h/3d/7d
     */
    async generate(scope = 'all', feedId = null, groupId = null, hours = 12) {
        // 检查 AI 配置
        if (!AIService.isConfigured()) {
            await Modal.alertWithSettings(i18n.t('digest.ai_not_configured'), i18n.t('common.go_to_settings'), () => Dialogs.showSettingsDialog(false));
            return;
        }

        // 显示正在生成提示 (长连接，提示用户稍后查看)
        showToast(i18n.t('digest.generating'), 5000, true);

        try {
            const aiConfig = AIService.getConfig();

            const response = await AuthManager.fetchWithAuth('/api/digest/generate?stream=true', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    scope,
                    feedId,
                    groupId,
                    hours: hours || 12,
                    targetLang: AIService.getLanguageName(aiConfig.targetLang || 'zh-CN'),
                    prompt: aiConfig.digestPrompt
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || i18n.t('digest.error'));
            }

            // 处理 SSE 流
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6).trim();
                            if (!dataStr) continue;

                            try {
                                const event = JSON.parse(dataStr);

                                if (event.type === 'error') {
                                    throw new Error(event.data?.error || i18n.t('digest.error'));
                                }

                                if (event.type === 'result') {
                                    const { digest } = event.data;

                                    if (digest && digest.id) {
                                        // 成功生成，显示可交互 Toast

                                        // 标记列表强制刷新，以便下次进入列表时重新加载（显示新简报）
                                        // 不要直接清空 AppState.articles，否则会导致当前显示的列表突然清空
                                        if (this.viewManager) {
                                            this.viewManager.forceRefreshList = true;
                                        }

                                        // 构建跳转链接
                                        const params = new URLSearchParams();
                                        if (feedId) params.set('feed', feedId);
                                        if (groupId) params.set('group', groupId);
                                        const queryString = params.toString();
                                        const hash = queryString
                                            ? `#/article/${digest.id}?${queryString}`
                                            : `#/article/${digest.id}`;

                                        showToast(i18n.t('digest.success'), 15000, false, () => {
                                            window.location.hash = hash;
                                        });
                                    } else {
                                        // 无内容
                                        showToast(digest?.content || i18n.t('digest.no_articles', { hours: 12 }), 5000, false);
                                    }
                                }
                            } catch (e) {
                                if (e.message && e.message !== 'Unexpected end of JSON input') {
                                    throw e;
                                }
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            console.error('Generate digest error:', error);
            // 只有明显错误才弹窗，避免干扰
            if (error.name !== 'AbortError') {
                showToast(error.message || i18n.t('digest.error'), 5000, false);
            }
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
    },

    /**
     * 显示「生成简报」对话框：选择目标分组 + 时间范围后生成
     * @param {Object} context - { feedId, groupId } 预选范围，空则「全部」
     */
    showGenerateDialog(context = {}) {
        const { feedId, groupId } = context;
        let scope = 'all';
        let scopeId = null;
        if (groupId) {
            scope = 'group';
            scopeId = groupId;
        } else if (feedId) {
            scope = 'feed';
            scopeId = feedId;
        }

        const groups = AppState.groups || [];
        const feeds = AppState.feeds || [];
        const initialScopeValue = scope === 'all' ? 'all' : `${scope}_${scopeId}`;

        let scopeOptionsHtml = `<option value="all">${i18n.t('nav.all')}</option>`;
        if (groups.length > 0) {
            scopeOptionsHtml += `<optgroup label="${i18n.t('nav.categories')}">`;
            groups.forEach(g => {
                scopeOptionsHtml += `<option value="group_${g.id}">${g.name}</option>`;
            });
            scopeOptionsHtml += `</optgroup>`;
        }
        if (feeds.length > 0) {
            scopeOptionsHtml += `<optgroup label="${i18n.t('nav.feeds')}">`;
            groups.forEach(g => {
                const groupFeeds = feeds.filter(f => f.category?.id == g.id);
                groupFeeds.forEach(f => {
                    scopeOptionsHtml += `<option value="feed_${f.id}">${f.title}</option>`;
                });
            });
            const ungroupedFeeds = feeds.filter(f => !f.category?.id || !groups.find(g => g.id == f.category?.id));
            ungroupedFeeds.forEach(f => {
                scopeOptionsHtml += `<option value="feed_${f.id}">${f.title}</option>`;
            });
            scopeOptionsHtml += `</optgroup>`;
        }

        const rangeOptionsHtml = [
            { value: 12, key: 'range_12h' },
            { value: 24, key: 'range_24h' },
            { value: 72, key: 'range_3d' },
            { value: 168, key: 'range_7d' },
            { value: 0, key: 'range_all' }
        ].map(r => `<option value="${r.value}">${i18n.t(`digest.${r.key}`)}</option>`).join('');

        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative; max-width: 360px;">
                <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                    ${Icons.close}
                </button>
                <h3>${i18n.t('digest.generate')}</h3>
                <div style="margin-bottom: 16px;">
                    <div class="settings-item-label" style="margin-bottom: 8px;">${i18n.t('digest.select_target')}</div>
                    <select id="generate-scope-select" class="dialog-select">
                        ${scopeOptionsHtml}
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <div class="settings-item-label" style="margin-bottom: 8px;">${i18n.t('digest.time_range')}</div>
                    <select id="generate-range-select" class="dialog-select">
                        ${rangeOptionsHtml}
                    </select>
                </div>
                <div class="appearance-mode-group">
                    <button type="button" id="generate-digest-submit" class="appearance-mode-btn active" style="justify-content: center; width: 100%;">
                        ${i18n.t('digest.generate')}
                    </button>
                </div>
            </div>
        `);

        const scopeSelect = dialog.querySelector('#generate-scope-select');
        const rangeSelect = dialog.querySelector('#generate-range-select');
        const submitBtn = dialog.querySelector('#generate-digest-submit');

        scopeSelect.value = initialScopeValue;

        submitBtn.addEventListener('click', () => {
            const val = scopeSelect.value;
            let scope = 'all', feedId = null, groupId = null;
            if (val !== 'all') {
                const [s, ...idParts] = val.split('_');
                const id = idParts.join('_');
                if (s === 'group') {
                    scope = 'group';
                    groupId = parseInt(id, 10);
                } else if (s === 'feed') {
                    scope = 'feed';
                    feedId = parseInt(id, 10);
                }
            }
            const hours = parseInt(rangeSelect.value, 10);
            close();
            this.generate(scope, feedId, groupId, isNaN(hours) ? 12 : hours);
        });

        dialog.querySelector('.close-dialog-btn').addEventListener('click', close);
    }
};
