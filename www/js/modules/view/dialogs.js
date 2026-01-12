/**
 * Dialogs - 对话框模块
 * @module view/dialogs
 */

import { AppState } from '../../state.js';
import { DOMElements } from '../../dom.js';
import { FeedManager } from '../feed-manager.js';
import { AuthManager } from '../auth-manager.js';
import { setTheme, setColorScheme, THEMES, COLOR_SCHEME_MODES } from '../theme-manager.js';
import { createDialog, showToast } from './utils.js';
import { Modal, CustomSelect } from './components.js';

import { i18n } from '../i18n.js';
import { AIService, AI_LANGUAGES } from '../ai-service.js';

/**
 * 对话框管理
 */
export const Dialogs = {
    /** 视图管理器引用 */
    viewManager: null,

    /**
     * 初始化模块
     * @param {Object} viewManager - ViewManager 实例引用
     */
    init(viewManager) {
        this.viewManager = viewManager;
    },

    /**
     * 显示添加订阅对话框
     */
    showAddFeedDialog() {
        const groups = AppState.groups || [];
        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative;">
                <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <h3>${i18n.t('dialogs.add_feed_title')}</h3>
                
                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('dialogs.add_subscription')}</div>
                    ${groups.length > 0 ? `
                    <input type="url" id="new-feed-url" class="auth-input" placeholder="${i18n.t('dialogs.enter_rss_url')}" autofocus style="margin-bottom: 8px;">
                    <select id="new-feed-group" class="dialog-select" style="margin-bottom: 12px;">
                        ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                    </select>
                    <div class="appearance-mode-group">
                        <button class="confirm-btn appearance-mode-btn active" style="justify-content: center; width: 100%;">${i18n.t('dialogs.add')}</button>
                    </div>
                    ` : `
                    <div class="no-groups-warning" style="padding: 16px; background: var(--card-bg); border-radius: 8px; text-align: center; color: var(--meta-color);">
                        <p style="margin: 0 0 12px 0;">${i18n.t('dialogs.no_groups_alert')}</p>
                        <p style="margin: 0; font-size: 0.85em;">${i18n.t('dialogs.create_group_hint')}</p>
                    </div>
                    `}
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('settings.group_management')}</div>
                    <div class="appearance-mode-group">
                        <button id="manage-groups-btn" class="appearance-mode-btn">${i18n.t('settings.manage_groups')}</button>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('settings.data_management')}</div>
                    <div class="appearance-mode-group">
                        <button id="import-opml-btn" class="appearance-mode-btn">${i18n.t('settings.import_opml')}</button>
                        <button id="export-opml-btn" class="appearance-mode-btn">${i18n.t('settings.export_opml')}</button>
                        <input type="file" id="opml-file-input" accept=".opml,.xml" style="display: none;">
                    </div>
                </div>
            </div>
        `);

        const urlInput = dialog.querySelector('#new-feed-url');
        const groupSelect = dialog.querySelector('#new-feed-group');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const closeBtn = dialog.querySelector('.close-dialog-btn');
        const manageGroupsBtn = dialog.querySelector('#manage-groups-btn');
        const importBtn = dialog.querySelector('#import-opml-btn');
        const exportBtn = dialog.querySelector('#export-opml-btn');
        const opmlFileInput = dialog.querySelector('#opml-file-input');

        closeBtn.addEventListener('click', close);

        // Init Custom Select
        const container = dialog.querySelector('.settings-dialog-content');
        if (container) CustomSelect.replaceAll(container);

        // 只有在有分组时才绑定添加订阅相关的事件
        if (confirmBtn && urlInput && groupSelect) {
            confirmBtn.addEventListener('click', async () => {
                const url = urlInput.value.trim();
                if (!url) return;

                const groupId = groupSelect.value;
                if (!groupId) {
                    await Modal.alert(i18n.t('dialogs.no_groups_alert'));
                    return;
                }

                confirmBtn.textContent = i18n.t('dialogs.adding');
                confirmBtn.disabled = true;

                try {
                    await FeedManager.addFeed(url, groupId);
                    close();
                    await this.viewManager.loadFeeds();
                } catch (err) {
                    await Modal.alert(err.message);
                    confirmBtn.textContent = i18n.t('dialogs.add');
                    confirmBtn.disabled = false;
                }
            });

            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmBtn.click();
                if (e.key === 'Escape') close();
            });
        }

        // 管理分组
        manageGroupsBtn.addEventListener('click', () => {
            close();
            this.showGroupManagerDialog();
        });

        // 导入 OPML
        importBtn.addEventListener('click', async () => {
            // 检查是否有分组
            const currentGroups = AppState.groups || [];
            if (currentGroups.length === 0) {
                await Modal.alert(i18n.t('dialogs.no_groups_alert'));
                return;
            }
            opmlFileInput.click();
        });

        opmlFileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const originalText = importBtn.textContent;
                importBtn.textContent = i18n.t('settings.importing');
                importBtn.disabled = true;

                try {
                    await FeedManager.importOpml(file);
                    try {
                        await FeedManager.refreshFeeds();
                    } catch (err) {
                        console.warn('Auto refresh after import failed:', err);
                    }
                    showToast(i18n.t('settings.import_success_refresh'), 3000, false);
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } catch (err) {
                    await Modal.alert(err.message);
                    importBtn.textContent = originalText;
                    importBtn.disabled = false;
                }
                opmlFileInput.value = '';
            }
        });

        // 导出 OPML
        exportBtn.addEventListener('click', async () => {
            const originalText = exportBtn.textContent;
            exportBtn.textContent = i18n.t('settings.exporting');
            exportBtn.disabled = true;

            try {
                const blob = await FeedManager.exportOpml();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tidyflux.opml';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (err) {
                await Modal.alert(err.message);
            } finally {
                exportBtn.textContent = originalText;
                exportBtn.disabled = false;
            }
        });
    },

    /**
     * 显示编辑订阅对话框
     * @param {string|number} feedId - 订阅源 ID
     */
    showEditFeedDialog(feedId) {
        // Initial Loading State
        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative; min-height: 200px; display: flex; align-items: center; justify-content: center;">
                <div class="miniflux-loading">${i18n.t('app.loading')}</div>
            </div>
        `);

        // Load Data
        (async () => {
            try {
                const feed = await FeedManager.getFeed(feedId);
                const groups = AppState.groups || [];

                // Render Form
                const contentHtml = `
                    <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                    <h3>${i18n.t('dialogs.edit_subscription')}</h3>
                    
                    <div class="settings-section">
                        <label class="miniflux-input-label">${i18n.t('dialogs.feed_title')}</label>
                        <input type="text" id="edit-feed-title" class="auth-input" value="${feed.title}" style="margin-bottom: 12px;">

                        <div style="margin-bottom: 12px;">
                            <label class="miniflux-input-label">${i18n.t('nav.categories')}</label>
                            <select id="edit-feed-group" class="dialog-select">
                                ${groups.map(g => `<option value="${g.id}" ${feed.category.id == g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                            </select>
                        </div>

                        <label class="miniflux-input-label">${i18n.t('dialogs.site_url')}</label>
                        <input type="url" id="edit-site-url" class="auth-input" value="${feed.site_url}" style="margin-bottom: 12px;">

                        <label class="miniflux-input-label">${i18n.t('dialogs.feed_url')}</label>
                        <input type="url" id="edit-feed-url" class="auth-input" value="${feed.feed_url}" style="margin-bottom: 12px;">



                        <div class="appearance-mode-group" style="margin-top: 24px;">
                             <button id="delete-feed-btn" class="appearance-mode-btn danger" style="flex: 1;">${i18n.t('context.delete_feed')}</button>
                            <button id="save-feed-btn" class="appearance-mode-btn active" style="flex: 1;">${i18n.t('dialogs.update')}</button>
                        </div>
                    </div>
                `;

                const container = dialog.querySelector('.settings-dialog-content');
                container.style.display = 'block';
                container.style.minHeight = 'auto';
                container.style.alignItems = 'initial';
                container.style.justifyContent = 'initial';
                container.innerHTML = contentHtml;

                // Bind Events
                const closeBtn = dialog.querySelector('.close-dialog-btn');

                // Init Custom Select
                CustomSelect.replaceAll(container);
                const saveBtn = dialog.querySelector('#save-feed-btn');
                const deleteBtn = dialog.querySelector('#delete-feed-btn');
                const titleInput = dialog.querySelector('#edit-feed-title');
                const groupSelect = dialog.querySelector('#edit-feed-group');
                const siteUrlInput = dialog.querySelector('#edit-site-url');
                const feedUrlInput = dialog.querySelector('#edit-feed-url');


                closeBtn.addEventListener('click', close);

                saveBtn.addEventListener('click', async () => {
                    const updates = {
                        title: titleInput.value.trim(),
                        category_id: parseInt(groupSelect.value, 10),
                        site_url: siteUrlInput.value.trim(),
                        feed_url: feedUrlInput.value.trim(),

                    };

                    if (!updates.title || !updates.feed_url) {
                        await Modal.alert(i18n.t('settings.fill_all_info'));
                        return;
                    }

                    saveBtn.textContent = i18n.t('settings.saving');
                    saveBtn.disabled = true;

                    try {
                        await FeedManager.updateFeed(feedId, updates);
                        close();
                        await this.viewManager.loadFeeds();
                        // If current feed is the one edited, reload articles to reflect potential changes
                        if (AppState.currentFeedId == feedId) {
                            // Assuming access to DOMElements through imports in dialogs.js, but let's check
                            // DOMElements is imported.
                            DOMElements.currentFeedTitle.textContent = updates.title;
                        }
                    } catch (err) {
                        await Modal.alert(err.message);
                        saveBtn.textContent = i18n.t('dialogs.update');
                        saveBtn.disabled = false;
                    }
                });

                deleteBtn.addEventListener('click', async () => {
                    if (await Modal.confirm(i18n.t('context.confirm_delete_feed'))) {
                        try {
                            await FeedManager.deleteFeed(feedId);
                            close();
                            await this.viewManager.loadFeeds();
                            if (AppState.currentFeedId == feedId) {
                                window.location.hash = '#/all';
                            }
                        } catch (err) {
                            await Modal.alert(err.message);
                        }
                    }
                });

            } catch (err) {
                console.error('Load feed info error:', err);
                const container = dialog.querySelector('.settings-dialog-content');
                container.innerHTML = `
                    <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                    <div class="miniflux-config-error" style="text-align:center; padding: 20px;">${i18n.t('common.load_error')}</div>
                 `;
                dialog.querySelector('.close-dialog-btn').addEventListener('click', close);
            }
        })();
    },

    /**
     * 显示分组管理对话框
     */
    showGroupManagerDialog() {
        const renderGroupList = () => {
            const groups = AppState.groups || [];
            if (groups.length === 0) {
                return `<div class="empty-msg" style="padding: 20px; text-align: center;">${i18n.t('dialogs.no_groups')}</div>`;
            }
            return groups.map(g => `
                <div class="group-manager-item" data-group-id="${g.id}">
                    <span class="group-manager-name">${g.name}</span>
                    <span class="group-manager-count">${i18n.t('dialogs.subscription_count', { count: g.feed_count || 0 })}</span>
                    <div class="group-manager-actions">
                        <button class="group-rename-btn" data-group-id="${g.id}" data-group-name="${g.name}" title="${i18n.t('context.rename')}">✎</button>
                        <button class="group-delete-btn" data-group-id="${g.id}" title="${i18n.t('context.delete_group')}">×</button>
                    </div>
                </div>
            `).join('');
        };

        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative;">
                <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <h3>${i18n.t('dialogs.manage_groups')}</h3>
                
                <div class="group-add-row">
                    <input type="text" id="new-group-name" placeholder="${i18n.t('dialogs.new_group_placeholder')}" class="dialog-input">
                    <button id="add-group-btn" class="group-add-btn">${i18n.t('dialogs.add')}</button>
                </div>
                
                <div id="group-list" class="group-manager-list">
                    ${renderGroupList()}
                </div>
            </div>
        `);

        const groupList = dialog.querySelector('#group-list');
        const nameInput = dialog.querySelector('#new-group-name');
        const addBtn = dialog.querySelector('#add-group-btn');
        const closeBtn = dialog.querySelector('.close-dialog-btn');

        closeBtn.addEventListener('click', close);

        addBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) return;

            addBtn.disabled = true;
            try {
                await FeedManager.addGroup(name);
                nameInput.value = '';
                const [feeds, groups] = await Promise.all([FeedManager.getFeeds(), FeedManager.getGroups()]);
                AppState.feeds = feeds;
                AppState.groups = groups;
                groupList.innerHTML = renderGroupList();
                this.viewManager.renderFeedsList(feeds, groups);
            } catch (err) {
                await Modal.alert(err.message);
            } finally {
                addBtn.disabled = false;
            }
        });

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addBtn.click();
        });

        groupList.addEventListener('click', async (e) => {
            const renameBtn = e.target.closest('.group-rename-btn');
            if (renameBtn) {
                const groupId = renameBtn.dataset.groupId;
                const oldName = renameBtn.dataset.groupName;
                const newName = await Modal.prompt(i18n.t('auth.enter_new_group_name'), oldName);
                if (newName && newName.trim() && newName.trim() !== oldName) {
                    try {
                        await FeedManager.updateGroup(groupId, { name: newName.trim() });
                        const [feeds, groups] = await Promise.all([FeedManager.getFeeds(), FeedManager.getGroups()]);
                        AppState.feeds = feeds;
                        AppState.groups = groups;
                        groupList.innerHTML = renderGroupList();
                        this.viewManager.renderFeedsList(feeds, groups);
                    } catch (err) {
                        await Modal.alert(err.message);
                    }
                }
                return;
            }

            const deleteBtn = e.target.closest('.group-delete-btn');
            if (deleteBtn) {
                const groupId = deleteBtn.dataset.groupId;
                if (!await Modal.confirm(i18n.t('context.confirm_delete_group'))) return;
                try {
                    await FeedManager.deleteGroup(groupId);
                    const [feeds, groups] = await Promise.all([FeedManager.getFeeds(), FeedManager.getGroups()]);
                    AppState.feeds = feeds;
                    AppState.groups = groups;
                    groupList.innerHTML = renderGroupList();
                    this.viewManager.renderFeedsList(feeds, groups);
                } catch (err) {
                    await Modal.alert(err.message);
                }
            }
        });
    },

    /**
     * 显示设置对话框
     * @param {boolean} forceMode - 强制模式，不可关闭，仅显示 Miniflux 配置
     */
    showSettingsDialog(forceMode = false) {
        const vm = this.viewManager;
        const currentTheme = AppState.preferences?.theme || 'default';
        const currentColorScheme = AppState.preferences?.color_scheme || 'auto';
        const currentLang = i18n.locale;

        const langSelectOptions = [
            { id: 'zh', name: '简体中文' },
            { id: 'en', name: 'English' }
        ].map(lang =>
            `<option value="${lang.id}" ${currentLang === lang.id ? 'selected' : ''}>${lang.name}</option>`
        ).join('');

        // 强制模式下只显示 Miniflux 配置相关内容
        const showFullSettings = !forceMode;

        // 主题色选项
        const themeOptions = THEMES.map(theme =>
            `<button class="theme-color-btn ${currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}" title="${i18n.t('theme.' + theme.id)}">
                <span class="color-dot" style="background-color: ${theme.color || 'var(--accent-color)'}"></span>
            </button>`
        ).join('');

        // 颜色模式选项
        const colorModeOptions = COLOR_SCHEME_MODES.map(mode =>
            `<button class="appearance-mode-btn ${currentColorScheme === mode.id ? 'active' : ''}" data-mode="${mode.id}">
                <span class="mode-icon">${mode.icon || ''}</span>
                ${i18n.t('settings.' + mode.id)}
            </button>`
        ).join('');

        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative;">
                ${showFullSettings ? `
                <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>` : ''}
                <h3>${forceMode ? i18n.t('settings.miniflux_settings') : i18n.t('settings.title')}</h3>
                ${forceMode ? `<p style="color: var(--meta-color); font-size: 0.9em; margin-bottom: 16px;">${i18n.t('auth.configure_miniflux_hint')}</p>` : ''}
                
                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('dialogs.miniflux_connection')}</div>
                    <div id="miniflux-config-info" class="miniflux-config-info">
                        <div class="miniflux-loading">${i18n.t('app.loading')}</div>
                    </div>
                </div>
                
                ${showFullSettings ? `
                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('settings.language')}</div>
                    <select id="settings-language-select" class="dialog-select">
                        ${langSelectOptions}
                    </select>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('settings.appearance')}</div>
                    
                    <div class="theme-option-group" style="margin-bottom: 16px;">
                        <div class="settings-item-label">${i18n.t('settings.theme_color')}</div>
                        <div class="theme-color-grid" id="settings-theme-colors">
                            ${themeOptions}
                        </div>
                    </div>

                    <div class="theme-option-group">
                        <div class="settings-item-label">${i18n.t('settings.mode')}</div>
                        <div class="appearance-mode-group" id="settings-appearance-modes">
                            ${colorModeOptions}
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('ai.settings_title')}</div>
                    <form id="ai-settings-form">
                        <label class="miniflux-input-label">${i18n.t('ai.api_url')}</label>
                        <input type="text" id="ai-api-url" class="auth-input" placeholder="https://api.openai.com/v1" style="margin-bottom: 8px;">
                        
                        <label class="miniflux-input-label">${i18n.t('ai.api_key')}</label>
                        <input type="text" id="ai-api-key" class="auth-input" placeholder="sk-..." style="margin-bottom: 8px; -webkit-text-security: disc;" autocomplete="off" spellcheck="false">
                        
                        <label class="miniflux-input-label">${i18n.t('ai.model')}</label>
                        <input type="text" id="ai-model" class="auth-input" placeholder="gpt-4.1-mini" style="margin-bottom: 12px;" autocomplete="off">

                        <div style="margin-bottom: 12px;">
                            <label class="miniflux-input-label">${i18n.t('ai.target_lang')}</label>
                            <select id="ai-target-lang" class="dialog-select">
                                ${AI_LANGUAGES.map(lang =>
            `<option value="${lang.id}">${i18n.locale === 'zh' ? lang.name : lang.nameEn}</option>`
        ).join('')}
                            </select>
                        </div>

                        <div class="collapsible-section" style="margin-bottom: 16px;">
                            <button type="button" class="collapsible-toggle" style="background: none; border: none; padding: 0; color: var(--accent-color); font-size: 0.9em; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <span class="toggle-icon">▶</span> ${i18n.t('settings.edit_config')}
                            </button>
                            <div class="collapsible-content" style="display: none; margin-top: 12px;">
                                <label class="miniflux-input-label">${i18n.t('ai.translate_prompt')}</label>
                                <textarea id="ai-translate-prompt" class="auth-input" rows="3" placeholder="${i18n.t('ai.translate_prompt_placeholder')}" style="margin-bottom: 8px; resize: vertical; min-height: 80px;"></textarea>
                                
                                <label class="miniflux-input-label">${i18n.t('ai.summarize_prompt')}</label>
                                <textarea id="ai-summarize-prompt" class="auth-input" rows="3" placeholder="${i18n.t('ai.summarize_prompt_placeholder')}" style="margin-bottom: 8px; resize: vertical; min-height: 80px;"></textarea>
                                
                                <label class="miniflux-input-label">${i18n.t('ai.digest_prompt')}</label>
                                <textarea id="ai-digest-prompt" class="auth-input" rows="3" placeholder="${i18n.t('ai.digest_prompt_placeholder')}" style="margin-bottom: 8px; resize: vertical; min-height: 80px;"></textarea>

                                <button type="button" id="ai-reset-prompts-btn" style="background: none; border: none; color: var(--text-secondary); padding: 4px 0; font-size: 0.85em; cursor: pointer; margin-top: 8px;">
                                    ${i18n.t('ai.reset_prompts')}
                                </button>
                            </div>
                        </div>



                        <div class="appearance-mode-group">
                            <button type="button" id="ai-test-btn" class="appearance-mode-btn" style="flex: 1;">${i18n.t('settings.test_connection')}</button>
                            <button type="submit" class="appearance-mode-btn active" style="flex: 1;">${i18n.t('settings.save')}</button>
                        </div>
                        <div id="ai-settings-msg" style="text-align: center; margin-top: 8px; font-size: 0.85em;"></div>
                    </form>
                </div>
                


` : ''}
                
                ${showFullSettings ? `
                <div class="settings-section">
                    <div class="settings-section-title">${i18n.t('settings.account_security')}</div>

                    <form id="settings-change-password-form" style="margin-bottom: 16px;">
                        <input type="password" id="settings-new-password" class="auth-input" placeholder="${i18n.t('settings.new_password')}" style="margin-bottom: 8px;" required>
                        <input type="password" id="settings-confirm-password" class="auth-input" placeholder="${i18n.t('settings.confirm_password')}" style="margin-bottom: 8px;" required>
                        <div class="appearance-mode-group">
                            <button type="submit" class="appearance-mode-btn active" style="justify-content: center; width: 100%;">${i18n.t('settings.change_password')}</button>
                        </div>
                        <div style="text-align: center; margin-top: 8px;">
                            <span id="settings-password-msg" style="font-size: 0.85em;"></span>
                        </div>
                    </form>

                    <div class="settings-section-title" style="margin-top: 24px;">${i18n.t('settings.login')}</div>
                    <div class="appearance-mode-group">
                        <button class="logout-btn-full appearance-mode-btn active" style="justify-content: center; width: 100%;">${i18n.t('nav.logout')}</button>
                    </div>
                </div>` : ''}
            </div>
        `);

        const closeBtn = dialog.querySelector('.close-dialog-btn');
        const logoutBtn = dialog.querySelector('.logout-btn-full');
        const themeColorBtns = dialog.querySelectorAll('.theme-color-btn');
        const modeBtns = dialog.querySelectorAll('.appearance-mode-btn[data-mode]');
        const langSelect = dialog.querySelector('#settings-language-select');
        const passwordForm = dialog.querySelector('#settings-change-password-form');
        const passwordMsg = dialog.querySelector('#settings-password-msg');
        const minifluxConfigInfo = dialog.querySelector('#miniflux-config-info');

        // Init CustomSelects
        const contentContainer = dialog.querySelector('.settings-dialog-content');
        if (contentContainer) CustomSelect.replaceAll(contentContainer);

        // 渲染 Miniflux 配置表单
        const renderConfigForm = () => {
            minifluxConfigInfo.innerHTML = `
                <div class="miniflux-config-item">
                    <span class="miniflux-config-label">${i18n.t('settings.status')}</span>
                    <span class="miniflux-config-value miniflux-status-disconnected">
                        <span class="status-dot"></span>${i18n.t('settings.not_configured')}
                    </span>
                </div>
                <form id="miniflux-config-form" class="miniflux-config-form">
                    <label class="miniflux-input-label">${i18n.t('settings.miniflux_url')}</label>
                    <input type="text" id="miniflux-url" class="auth-input" placeholder="https://miniflux.example.com" style="margin-bottom: 12px;" required>
                    
                    <label class="miniflux-input-label">${i18n.t('settings.auth_method')}</label>
                    <div class="auth-type-selector" style="display:flex; gap:10px; margin-bottom:12px;">
                        <button type="button" class="appearance-mode-btn active" id="auth-type-basic" style="flex:1; justify-content:center;">${i18n.t('settings.auth_basic')}</button>
                        <button type="button" class="appearance-mode-btn" id="auth-type-apikey" style="flex:1; justify-content:center;">${i18n.t('settings.auth_api_key')}</button>
                    </div>

                    <div id="auth-fields-basic">
                        <label class="miniflux-input-label">${i18n.t('settings.username_password')}</label>
                        <input type="text" id="miniflux-username" class="auth-input" placeholder="admin" style="margin-bottom: 8px;">
                        <input type="password" id="miniflux-password" class="auth-input" placeholder="••••••••" style="margin-bottom: 12px;">
                    </div>

                    <div id="auth-fields-apikey" style="display:none;">
                        <label class="miniflux-input-label">${i18n.t('settings.auth_api_key')}</label>
                        <input type="password" id="miniflux-api-key" class="auth-input" placeholder="${i18n.t('settings.api_key_placeholder')}" style="margin-bottom: 12px;" autocomplete="off">
                    </div>

                    <div class="appearance-mode-group">
                        <button type="button" id="miniflux-test-btn" class="appearance-mode-btn" style="flex: 1;">${i18n.t('settings.test_connection')}</button>
                        <button type="submit" class="appearance-mode-btn active" style="flex: 1;">${i18n.t('settings.save_config')}</button>
                    </div>
                    <div id="miniflux-config-msg" style="text-align: center; margin-top: 8px; font-size: 0.85em;"></div>
                </form>
            `;

            // 绑定表单事件
            const form = minifluxConfigInfo.querySelector('#miniflux-config-form');
            const testBtn = minifluxConfigInfo.querySelector('#miniflux-test-btn');
            const msgEl = minifluxConfigInfo.querySelector('#miniflux-config-msg');
            const urlInput = minifluxConfigInfo.querySelector('#miniflux-url');
            const usernameInput = minifluxConfigInfo.querySelector('#miniflux-username');
            const passwordInput = minifluxConfigInfo.querySelector('#miniflux-password');
            const apiKeyInput = minifluxConfigInfo.querySelector('#miniflux-api-key');

            const btnBasic = minifluxConfigInfo.querySelector('#auth-type-basic');
            const btnApiKey = minifluxConfigInfo.querySelector('#auth-type-apikey');
            const fieldsBasic = minifluxConfigInfo.querySelector('#auth-fields-basic');
            const fieldsApiKey = minifluxConfigInfo.querySelector('#auth-fields-apikey');

            let currentAuthType = 'basic';

            const toggleAuthType = (type) => {
                currentAuthType = type;
                if (type === 'basic') {
                    btnBasic.classList.add('active');
                    btnApiKey.classList.remove('active');
                    fieldsBasic.style.display = 'block';
                    fieldsApiKey.style.display = 'none';
                } else {
                    btnBasic.classList.remove('active');
                    btnApiKey.classList.add('active');
                    fieldsBasic.style.display = 'none';
                    fieldsApiKey.style.display = 'block';
                }
            };

            btnBasic.addEventListener('click', () => toggleAuthType('basic'));
            btnApiKey.addEventListener('click', () => toggleAuthType('api_key'));

            // 自动补全 URL 协议
            const normalizeUrl = (url) => {
                url = url.trim();
                if (!url) return url;
                if (!url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                }
                return url.replace(/\/+$/, '');
            };

            const getFormData = () => {
                const url = normalizeUrl(urlInput.value);
                urlInput.value = url;

                if (currentAuthType === 'basic') {
                    return {
                        url,
                        username: usernameInput.value.trim(),
                        password: passwordInput.value,
                        apiKey: null,
                        authType: 'basic'
                    };
                } else {
                    return {
                        url,
                        username: '',
                        password: '',
                        apiKey: apiKeyInput.value.trim(),
                        authType: 'api_key'
                    };
                }
            };

            // 测试连接
            testBtn.addEventListener('click', async () => {
                const data = getFormData();

                if (!data.url) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }

                if (data.authType === 'basic' && (!data.username || !data.password)) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }
                if (data.authType === 'api_key' && !data.apiKey) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }

                testBtn.disabled = true;
                testBtn.textContent = i18n.t('settings.testing');
                msgEl.textContent = '';

                try {
                    const result = await AuthManager.testMinifluxConnection(
                        data.url, data.username, data.password, data.apiKey, data.authType
                    );
                    msgEl.textContent = `✓ ${i18n.t('settings.connection_success')} (${result.user})`;
                    msgEl.style.color = '#52c41a';
                } catch (err) {
                    msgEl.textContent = err.message;
                    msgEl.style.color = '#ff4d4f';
                } finally {
                    testBtn.disabled = false;
                    testBtn.textContent = i18n.t('settings.test_connection');
                }
            });

            // 保存配置
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = getFormData();

                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = i18n.t('settings.saving');
                msgEl.textContent = '';

                try {
                    await AuthManager.saveMinifluxConfig(
                        data.url, data.username, data.password, data.apiKey, data.authType
                    );
                    msgEl.textContent = `✓ ${i18n.t('settings.save_success_refresh')}`;
                    msgEl.style.color = '#52c41a';
                    // 刷新显示
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } catch (err) {
                    msgEl.textContent = err.message;
                    msgEl.style.color = '#ff4d4f';
                    submitBtn.disabled = false;
                    submitBtn.textContent = i18n.t('settings.save_config');
                }
            });
        };

        // 渲染已配置状态
        const renderConfigured = (config) => {
            const sourceText = config.source === 'env' ? i18n.t('settings.env_var') : i18n.t('settings.manual_config');
            const isEnv = config.source === 'env';

            minifluxConfigInfo.innerHTML = `
                <div class="miniflux-config-item">
                    <span class="miniflux-config-label">${i18n.t('settings.status')}</span>
                    <span class="miniflux-config-value miniflux-status-connected" id="miniflux-status-value">
                        <span class="status-dot" style="background-color: var(--meta-color);"></span>${i18n.t('settings.connected')} ${sourceText} <span style="font-size: 0.9em; opacity: 0.8;">(${i18n.t('app.loading')}...)</span>
                    </span>
                </div>
                <div class="miniflux-config-item">
                    <span class="miniflux-config-label">${i18n.t('settings.server_url')}</span>
                    <span class="miniflux-config-value">${config.url}</span>
                </div>
                <div class="miniflux-config-item">
                    <span class="miniflux-config-label">${config.authType === 'api_key' ? i18n.t('settings.auth_api_key') : i18n.t('settings.username')}</span>
                    <span class="miniflux-config-value">${config.authType === 'api_key' ? '********' : (config.username || '-')}</span>
                </div>
                ${!isEnv ? `
                <div class="appearance-mode-group" style="margin-top: 12px;">
                    <button id="edit-miniflux-config-btn" class="appearance-mode-btn" style="justify-content: center; width: 100%;">${i18n.t('settings.edit_connection')}</button>
                </div>
                ` : ''}
            `;

            // 异步检查真实连接状态
            AuthManager.getMinifluxStatus().then(status => {
                const statusEl = minifluxConfigInfo.querySelector('#miniflux-status-value');
                if (statusEl) {
                    if (status.connected) {
                        statusEl.innerHTML = `<span class="status-dot"></span>${i18n.t('settings.connected')} ${sourceText}`;
                    } else {
                        statusEl.className = 'miniflux-config-value miniflux-status-disconnected';
                        // 使用 style 覆盖默认颜色，确保错误状态显眼
                        statusEl.style.color = 'var(--danger-color)';
                        statusEl.innerHTML = `<span class="status-dot" style="background-color: var(--danger-color);"></span>${i18n.t('auth.login_failed')}: ${status.error || 'Connection Invalid'}`;
                    }
                }
            }).catch(err => {
                console.error('Check status failed', err);
                const statusEl = minifluxConfigInfo.querySelector('#miniflux-status-value');
                if (statusEl) {
                    statusEl.className = 'miniflux-config-value miniflux-status-disconnected';
                    statusEl.style.color = 'var(--danger-color)';
                    statusEl.innerHTML = `<span class="status-dot" style="background-color: var(--danger-color);"></span>Error: ${err.message}`;
                }
            });

            // 绑定修改配置按钮事件（仅非环境变量配置时显示）
            if (!isEnv) {
                const editBtn = minifluxConfigInfo.querySelector('#edit-miniflux-config-btn');
                editBtn?.addEventListener('click', () => {
                    renderConfigFormWithValues(config.url, config.username, config.apiKey, config.authType);
                });
            }
        };

        // 渲染配置表单（带预填值）
        const renderConfigFormWithValues = (prefillUrl = '', prefillUsername = '', prefillApiKey = '', prefillAuthType = 'basic') => {
            minifluxConfigInfo.innerHTML = `
                <div class="miniflux-config-item">
                    <span class="miniflux-config-label">${i18n.t('settings.status')}</span>
                    <span class="miniflux-config-value miniflux-status-disconnected">
                        <span class="status-dot"></span>${i18n.t('settings.editing')}
                    </span>
                </div>
                <form id="miniflux-config-form" class="miniflux-config-form">
                    <label class="miniflux-input-label">${i18n.t('settings.miniflux_url')}</label>
                    <input type="text" id="miniflux-url" class="auth-input" placeholder="https://miniflux.example.com" style="margin-bottom: 12px;" value="${prefillUrl}" required>
                    
                    <label class="miniflux-input-label">${i18n.t('settings.auth_method')}</label>
                    <div class="auth-type-selector" style="display:flex; gap:10px; margin-bottom:12px;">
                        <button type="button" class="appearance-mode-btn ${prefillAuthType === 'basic' ? 'active' : ''}" id="auth-type-basic" style="flex:1; justify-content:center;">${i18n.t('settings.auth_basic')}</button>
                        <button type="button" class="appearance-mode-btn ${prefillAuthType === 'api_key' ? 'active' : ''}" id="auth-type-apikey" style="flex:1; justify-content:center;">${i18n.t('settings.auth_api_key')}</button>
                    </div>

                    <div id="auth-fields-basic" style="${prefillAuthType === 'basic' ? 'display:block' : 'display:none'}">
                        <label class="miniflux-input-label">${i18n.t('settings.username_password')}</label>
                        <input type="text" id="miniflux-username" class="auth-input" placeholder="admin" style="margin-bottom: 8px;" value="${prefillUsername}">
                        <input type="password" id="miniflux-password" class="auth-input" placeholder="${i18n.t('settings.enter_new_password')}" style="margin-bottom: 12px;">
                    </div>

                    <div id="auth-fields-apikey" style="${prefillAuthType === 'api_key' ? 'display:block' : 'display:none'}">
                        <label class="miniflux-input-label">${i18n.t('settings.auth_api_key')}</label>
                        <input type="password" id="miniflux-api-key" class="auth-input" placeholder="${i18n.t('settings.api_key_placeholder')}" style="margin-bottom: 12px;" value="${prefillApiKey || ''}" autocomplete="off">
                    </div>

                    <div class="appearance-mode-group">
                        <button type="button" id="miniflux-cancel-btn" class="appearance-mode-btn" style="flex: 1;">${i18n.t('common.cancel')}</button>
                        <button type="button" id="miniflux-test-btn" class="appearance-mode-btn" style="flex: 1;">${i18n.t('settings.test_connection')}</button>
                        <button type="submit" class="appearance-mode-btn active" style="flex: 1;">${i18n.t('settings.save_config')}</button>
                    </div>
                    <div id="miniflux-config-msg" style="text-align: center; margin-top: 8px; font-size: 0.85em;"></div>
                </form>
            `;

            // 绑定表单事件
            const form = minifluxConfigInfo.querySelector('#miniflux-config-form');
            const testBtn = minifluxConfigInfo.querySelector('#miniflux-test-btn');
            const cancelBtn = minifluxConfigInfo.querySelector('#miniflux-cancel-btn');
            const msgEl = minifluxConfigInfo.querySelector('#miniflux-config-msg');
            const urlInput = minifluxConfigInfo.querySelector('#miniflux-url');
            const usernameInput = minifluxConfigInfo.querySelector('#miniflux-username');
            const passwordInput = minifluxConfigInfo.querySelector('#miniflux-password');
            const apiKeyInput = minifluxConfigInfo.querySelector('#miniflux-api-key');

            const btnBasic = minifluxConfigInfo.querySelector('#auth-type-basic');
            const btnApiKey = minifluxConfigInfo.querySelector('#auth-type-apikey');
            const fieldsBasic = minifluxConfigInfo.querySelector('#auth-fields-basic');
            const fieldsApiKey = minifluxConfigInfo.querySelector('#auth-fields-apikey');

            let currentAuthType = prefillAuthType || 'basic';

            const toggleAuthType = (type) => {
                currentAuthType = type;
                if (type === 'basic') {
                    btnBasic.classList.add('active');
                    btnApiKey.classList.remove('active');
                    fieldsBasic.style.display = 'block';
                    fieldsApiKey.style.display = 'none';
                } else {
                    btnBasic.classList.remove('active');
                    btnApiKey.classList.add('active');
                    fieldsBasic.style.display = 'none';
                    fieldsApiKey.style.display = 'block';
                }
            };

            btnBasic.addEventListener('click', () => toggleAuthType('basic'));
            btnApiKey.addEventListener('click', () => toggleAuthType('api_key'));

            // 自动补全 URL 协议
            const normalizeUrl = (url) => {
                url = url.trim();
                if (!url) return url;
                if (!url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                }
                return url.replace(/\/+$/, '');
            };

            const getFormData = () => {
                const url = normalizeUrl(urlInput.value);
                urlInput.value = url;

                if (currentAuthType === 'basic') {
                    // 如果在此模式下，且没有输入新密码，则可能用户不想修改密码
                    // 但这里是“手动配置”的逻辑，后端是saveManualConfig。
                    // 这里的逻辑是：如果用户在编辑状态，如果不输入密码，可能想保留原密码？
                    // 由于MinifluxConfigStore加密存储，这里如果不提供密码，后端无法解密原密码。
                    // 所以用户必须重新输入密码。 placeholder已经提示 Enter new password.

                    return {
                        url,
                        username: usernameInput.value.trim(),
                        password: passwordInput.value,
                        apiKey: null,
                        authType: 'basic'
                    };
                } else {
                    return {
                        url,
                        username: '',
                        password: '',
                        apiKey: apiKeyInput.value.trim(),
                        authType: 'api_key'
                    };
                }
            };

            // 取消编辑
            cancelBtn.addEventListener('click', async () => {
                try {
                    const config = await AuthManager.getMinifluxConfig();
                    if (config.configured) {
                        renderConfigured(config);
                    } else {
                        renderConfigForm();
                    }
                } catch (err) {
                    console.error('Load Miniflux config error:', err);
                }
            });

            // 测试连接
            testBtn.addEventListener('click', async () => {
                const data = getFormData();

                if (!data.url) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }

                if (data.authType === 'basic' && (!data.username || !data.password)) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }
                if (data.authType === 'api_key' && !data.apiKey) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }

                testBtn.disabled = true;
                testBtn.textContent = i18n.t('settings.testing');
                msgEl.textContent = '';

                try {
                    const result = await AuthManager.testMinifluxConnection(
                        data.url, data.username, data.password, data.apiKey, data.authType
                    );
                    msgEl.textContent = `✓ ${i18n.t('settings.connection_success')} (${result.user})`;
                    msgEl.style.color = '#52c41a';
                } catch (err) {
                    msgEl.textContent = err.message;
                    msgEl.style.color = '#ff4d4f';
                } finally {
                    testBtn.disabled = false;
                    testBtn.textContent = i18n.t('settings.test_connection');
                }
            });

            // 保存配置
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = getFormData();

                // Save Logic...
                // Validate if password is required. 
                // Currently yes, forcing re-entry for security/simplicity.
                if (data.authType === 'basic' && !data.password) {
                    msgEl.textContent = i18n.t('settings.fill_all_info');
                    msgEl.style.color = '#ff4d4f';
                    return;
                }

                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = i18n.t('settings.saving');
                msgEl.textContent = '';

                try {
                    await AuthManager.saveMinifluxConfig(
                        data.url, data.username, data.password, data.apiKey, data.authType
                    );
                    msgEl.textContent = `✓ ${i18n.t('settings.save_success_refresh')}`;
                    msgEl.style.color = '#52c41a';
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } catch (err) {
                    msgEl.textContent = err.message;
                    msgEl.style.color = '#ff4d4f';
                    submitBtn.disabled = false;
                    submitBtn.textContent = i18n.t('settings.save_config');
                }
            });
        };

        // 异步加载 Miniflux 配置信息
        (async () => {
            try {
                const config = await AuthManager.getMinifluxConfig();
                if (config.configured) {
                    renderConfigured(config);
                } else {
                    renderConfigForm();
                }
            } catch (err) {
                console.error('Load Miniflux config error:', err);
                minifluxConfigInfo.innerHTML = `
                    <div class="miniflux-config-error" style="text-align: center; color: var(--danger-color); margin-bottom: 12px;">${i18n.t('common.load_error')}</div>
                    <div class="appearance-mode-group">
                        <button id="retry-miniflux-btn" class="appearance-mode-btn" style="width: 100%; justify-content: center;">${i18n.t('settings.edit_connection')}</button>
                    </div>
                `;
                const retryBtn = minifluxConfigInfo.querySelector('#retry-miniflux-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        renderConfigForm();
                    });
                }
            }
        })();

        // 强制模式下不允许关闭
        if (!forceMode) {
            closeBtn?.addEventListener('click', close);
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) close();
            });
        }

        // 主题色切换
        themeColorBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const theme = btn.dataset.theme;
                setTheme(theme);
                AppState.preferences = AppState.preferences || {};
                AppState.preferences.theme = theme;
                themeColorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                try {
                    await FeedManager.setPreference('theme', theme);
                } catch (err) {
                    console.error('Save theme error:', err);
                }
            });
        });

        // 颜色模式切换
        modeBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const mode = btn.dataset.mode;
                setColorScheme(mode);
                AppState.preferences = AppState.preferences || {};
                AppState.preferences.color_scheme = mode;
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                try {
                    await FeedManager.setPreference('color_scheme', mode);
                } catch (err) {
                    console.error('Save color scheme error:', err);
                }
            });
        });

        // 语言切换
        if (langSelect) {
            langSelect.addEventListener('change', async () => {
                const lang = langSelect.value;
                if (lang !== i18n.locale) {
                    try {
                        await FeedManager.setPreference('language', lang);
                    } catch (err) {
                        console.error('Save language preference error:', err);
                    }
                    i18n.locale = lang;
                    window.location.reload();
                }
            });
        }


        // AI 设置逻辑
        if (showFullSettings) {
            const aiForm = dialog.querySelector('#ai-settings-form');
            const aiUrlInput = dialog.querySelector('#ai-api-url');
            const aiKeyInput = dialog.querySelector('#ai-api-key');
            const aiModelInput = dialog.querySelector('#ai-model');
            const aiTargetLangSelect = dialog.querySelector('#ai-target-lang');
            const aiTranslatePromptInput = dialog.querySelector('#ai-translate-prompt');
            const aiSummarizePromptInput = dialog.querySelector('#ai-summarize-prompt');
            const aiDigestPromptInput = dialog.querySelector('#ai-digest-prompt');
            const aiMsg = dialog.querySelector('#ai-settings-msg');
            const collapsibleToggle = dialog.querySelector('.collapsible-toggle');
            const collapsibleContent = dialog.querySelector('.collapsible-content');

            // 加载当前 AI 配置
            const aiConfig = AIService.getConfig();
            const defaultTranslatePrompt = AIService.getDefaultPrompt('translate');
            const defaultSummarizePrompt = AIService.getDefaultPrompt('summarize');
            const defaultDigestPrompt = AIService.getDefaultPrompt('digest');

            if (aiUrlInput) aiUrlInput.value = aiConfig.apiUrl || '';
            if (aiKeyInput) aiKeyInput.value = aiConfig.apiKey || '';
            if (aiModelInput) aiModelInput.value = aiConfig.model || 'gpt-4.1-mini';

            if (aiTargetLangSelect) {
                aiTargetLangSelect.value = aiConfig.targetLang || 'zh-CN';
                aiTargetLangSelect.dispatchEvent(new Event('change'));
            }

            if (aiTranslatePromptInput) aiTranslatePromptInput.value = aiConfig.translatePrompt || defaultTranslatePrompt;
            if (aiSummarizePromptInput) aiSummarizePromptInput.value = aiConfig.summarizePrompt || defaultSummarizePrompt;
            if (aiDigestPromptInput) aiDigestPromptInput.value = aiConfig.digestPrompt || defaultDigestPrompt;

            // 折叠面板切换
            if (collapsibleToggle) {
                collapsibleToggle.addEventListener('click', () => {
                    const isHidden = collapsibleContent.style.display === 'none';
                    collapsibleContent.style.display = isHidden ? 'block' : 'none';
                    collapsibleToggle.querySelector('.toggle-icon').style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                    collapsibleToggle.querySelector('.toggle-icon').style.display = 'inline-block';
                    collapsibleToggle.querySelector('.toggle-icon').style.transition = 'transform 0.2s';
                });
            }

            // Reset Prompts Button
            const aiResetPromptsBtn = dialog.querySelector('#ai-reset-prompts-btn');
            if (aiResetPromptsBtn) {
                aiResetPromptsBtn.addEventListener('click', () => {
                    if (aiTranslatePromptInput) aiTranslatePromptInput.value = defaultTranslatePrompt;
                    if (aiSummarizePromptInput) aiSummarizePromptInput.value = defaultSummarizePrompt;
                    if (aiDigestPromptInput) aiDigestPromptInput.value = defaultDigestPrompt;
                });
            }



            // Test Connection
            const aiTestBtn = dialog.querySelector('#ai-test-btn');
            if (aiTestBtn) {
                aiTestBtn.addEventListener('click', async () => {
                    const config = {
                        apiUrl: aiUrlInput.value.trim(),
                        apiKey: aiKeyInput.value.trim(),
                        model: aiModelInput.value.trim(),
                        targetLang: aiTargetLangSelect.value
                    };

                    if (!config.apiUrl || !config.apiKey) {
                        aiMsg.textContent = i18n.t('settings.fill_all_info');
                        aiMsg.style.color = '#ff4d4f';
                        return;
                    }

                    aiTestBtn.disabled = true;
                    // Cache original text just in case
                    const originalText = aiTestBtn.textContent;
                    aiTestBtn.textContent = i18n.t('settings.testing');
                    aiMsg.textContent = '';

                    try {
                        const result = await AIService.testConnection(config);
                        aiMsg.textContent = `✓ Success! Reply: "${result.reply}"`;
                        aiMsg.style.color = '#52c41a';
                    } catch (err) {
                        aiMsg.textContent = err.message;
                        aiMsg.style.color = '#ff4d4f';
                    } finally {
                        aiTestBtn.disabled = false;
                        aiTestBtn.textContent = originalText;
                    }
                });
            }

            // 保存 AI 配置
            if (aiForm) {
                aiForm.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const config = {
                        apiUrl: aiUrlInput.value.trim(),
                        apiKey: aiKeyInput.value.trim(),
                        model: aiModelInput.value.trim(),
                        targetLang: aiTargetLangSelect.value,
                        translatePrompt: aiTranslatePromptInput.value.trim(),
                        summarizePrompt: aiSummarizePromptInput.value.trim(),
                        digestPrompt: aiDigestPromptInput.value.trim()
                    };

                    try {
                        await AIService.saveConfig(config);

                        aiMsg.textContent = `✓ ${i18n.t('ai.save_success')}`;
                        aiMsg.style.color = '#52c41a';
                    } catch (err) {
                        console.error('Save AI settings error:', err);
                        aiMsg.textContent = `${i18n.t('ai.api_error')}`;
                        aiMsg.style.color = '#ff4d4f';
                    }

                    setTimeout(() => {
                        aiMsg.textContent = '';
                    }, 3000);
                });
            }
        }

        // 修改密码（仅在非强制模式下存在）
        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newPwd = dialog.querySelector('#settings-new-password').value;
                const confirmPwd = dialog.querySelector('#settings-confirm-password').value;

                if (newPwd !== confirmPwd) {
                    passwordMsg.textContent = i18n.t('settings.password_mismatch');
                    passwordMsg.style.color = '#ff4d4f';
                    return;
                }

                const submitBtn = passwordForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;

                try {
                    await AuthManager.changePassword(newPwd);
                    passwordMsg.textContent = i18n.t('settings.password_change_success');
                    passwordMsg.style.color = '#52c41a';
                    dialog.querySelector('#settings-new-password').value = '';
                    dialog.querySelector('#settings-confirm-password').value = '';
                } catch (err) {
                    passwordMsg.textContent = err.message;
                    passwordMsg.style.color = '#ff4d4f';
                } finally {
                    submitBtn.disabled = false;
                }
            });
        }

        // 退出登录（仅在非强制模式下存在）
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (await Modal.confirm(i18n.t('auth.confirm_logout'))) {
                    close();
                    AuthManager.logout();
                }
            });
        }
    },

    /**
     * 显示定时简报配置对话框
     * @param {Object} context - { feedId, groupId } 如果都为空则针对 'all'
     */
    showDigestScheduleDialog(context = {}) {
        const { feedId, groupId } = context;
        let scope = 'all';
        let scopeId = null;
        let title = i18n.t('nav.all');

        if (groupId) {
            scope = 'group';
            scopeId = groupId;
            const group = AppState.groups?.find(g => g.id == groupId);
            title = group ? group.name : 'Group';
        } else if (feedId) {
            scope = 'feed';
            scopeId = feedId;
            const feed = AppState.feeds?.find(f => f.id == feedId);
            title = feed ? feed.title : 'Feed';
        }

        const { dialog, close } = createDialog('settings-dialog', `
            <div class="settings-dialog-content" style="position: relative; max-width: 400px; min-height: 480px;">
                <button class="icon-btn close-dialog-btn" title="${i18n.t('settings.close')}" style="position: absolute; right: 16px; top: 16px; width: 32px; height: 32px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <h3>${i18n.t('ai.scheduled_digest')}</h3>
                <p style="color: var(--meta-color); font-size: 0.9em; margin-bottom: 24px;">
                    ${i18n.t('ai.digest_target')}: <strong style="color: var(--text-primary);">${title}</strong>
                </p>

                <div class="schedule-loader" style="text-align: center; padding: 20px;">
                    ${i18n.t('app.loading')}
                </div>

                <form id="schedule-form" style="display: none;">
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                         <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 600;">${i18n.t('settings.enable')}</span>
                            <label class="switch">
                                <input type="checkbox" id="schedule-enabled">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>

                    <div id="schedule-config-area" style="transition: opacity 0.3s;">
                        <!-- Frequency Selection -->
                        <div style="margin-bottom: 20px;">
                            <div class="settings-item-label" style="margin-bottom: 8px;">${i18n.t('settings.frequency')}</div>
                            <div class="appearance-mode-group" style="margin-bottom: 0;">
                                <button type="button" class="appearance-mode-btn active" id="freq-once" style="flex: 1; justify-content: center;">
                                    ${i18n.t('settings.once_daily')}
                                </button>
                                <button type="button" class="appearance-mode-btn" id="freq-twice" style="flex: 1; justify-content: center;">
                                    ${i18n.t('settings.twice_daily')}
                                </button>
                            </div>
                            <p id="freq-desc" style="font-size: 0.85em; color: var(--meta-color); margin-top: 6px;">
                                ${i18n.t('settings.once_daily_desc')}
                            </p>
                        </div>

                        <!-- Time Picker -->
                        <div class="custom-time-picker" id="custom-time-picker" style="margin-bottom: 12px;">
                            <div class="time-picker-highlight"></div>
                            <div class="time-column hours-column">
                                ${Array.from({ length: 24 }, (_, i) => `<div class="time-item" data-value="${String(i).padStart(2, '0')}">${String(i).padStart(2, '0')}</div>`).join('')}
                            </div>
                            <div class="time-colon">:</div>
                            <div class="time-column minutes-column">
                                ${Array.from({ length: 12 }, (_, i) => {
            const min = i * 5;
            return `<div class="time-item" data-value="${String(min).padStart(2, '0')}">${String(min).padStart(2, '0')}</div>`;
        }).join('')}
                            </div>
                        </div>

                        <!-- Second Time Preview -->
                        <div id="second-time-preview" style="text-align: center; margin-bottom: 20px; font-size: 0.9em; color: var(--accent-color); display: none;">
                            <!-- JS filled -->
                        </div>
                    </div>

                    <div class="appearance-mode-group">
                        <button type="submit" class="appearance-mode-btn active" style="justify-content: center; width: 100%;">${i18n.t('settings.save')}</button>
                    </div>
                    <div id="schedule-msg" style="text-align: center; margin-top: 12px; font-size: 0.85em;"></div>
                    
                    <div style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 16px; text-align: center;">
                         <button type="button" id="manage-others-btn" style="background: transparent; border: none; color: var(--meta-color); font-size: 0.9em; cursor: pointer; text-decoration: underline;">
                             ${i18n.t('settings.manage_all_schedules')}
                         </button>
                    </div>
                </form>

                <!-- Other Schedules View -->
                <div id="other-schedules-view" style="display: none; height: 100%; flex-direction: column;">
                     <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <button type="button" id="back-to-main-btn" class="icon-btn" style="margin-right: 8px;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                            </svg>
                        </button>
                        <h4 style="margin: 0;">${i18n.t('settings.other_schedules')}</h4>
                     </div>
                     <div id="other-tasks-list" style="flex: 1; overflow-y: auto; padding-right: 4px;">
                         <!-- Filled by JS -->
                     </div>
                </div>
                </form>
            </div>
        `);

        const closeBtn = dialog.querySelector('.close-dialog-btn');
        const loader = dialog.querySelector('.schedule-loader');
        const form = dialog.querySelector('#schedule-form');
        const enabledInput = dialog.querySelector('#schedule-enabled');
        const configArea = dialog.querySelector('#schedule-config-area');

        const freqOnceBtn = dialog.querySelector('#freq-once');
        const freqTwiceBtn = dialog.querySelector('#freq-twice');
        const freqDesc = dialog.querySelector('#freq-desc');
        const secondTimePreview = dialog.querySelector('#second-time-preview');

        const pickerContainer = dialog.querySelector('#custom-time-picker');
        const msgEl = dialog.querySelector('#schedule-msg');
        const optionsDiv = dialog.querySelector('#schedule-options'); // Keeping ref for safety although structure changed

        const manageOthersBtn = dialog.querySelector('#manage-others-btn');
        const otherSchedulesView = dialog.querySelector('#other-schedules-view');
        const backToMainBtn = dialog.querySelector('#back-to-main-btn');
        const otherTasksList = dialog.querySelector('#other-tasks-list');

        // Logic state
        let allSchedules = [];
        let isTwiceDaily = false;
        let getPickerTime = () => '08:00';

        // --- Helpers ---

        const getScopeName = (tScope, tScopeId) => {
            if (tScope === 'all') return i18n.t('nav.all');
            if (tScope === 'group') {
                const group = AppState.groups?.find(g => g.id == tScopeId);
                return group ? group.name : `Group #${tScopeId}`;
            }
            if (tScope === 'feed') {
                const feed = AppState.feeds?.find(f => f.id == tScopeId);
                return feed ? feed.title : `Feed #${tScopeId}`;
            }
            return i18n.t('common.unnamed');
        };

        const renderOtherTasks = () => {
            // Filter out tasks belonging to CURRENT scope
            const isMatch = (t) => {
                if (t.scope !== scope) return false;
                if (t.scopeId == scopeId) return true;
                return String(t.scopeId || '') === String(scopeId || '');
            };
            const others = allSchedules.filter(t => !isMatch(t));

            if (others.length === 0) {
                otherTasksList.innerHTML = `<div style="text-align: center; color: var(--meta-color); padding: 20px;">${i18n.t('settings.no_other_schedules')}</div>`;
                return;
            }



            const grouped = {};
            others.forEach(t => {
                const key = `${t.scope}_${t.scopeId}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(t);
            });

            otherTasksList.innerHTML = '';

            Object.keys(grouped).forEach(key => {
                const tasks = grouped[key];
                const first = tasks[0];
                const name = getScopeName(first.scope, first.scopeId);

                const card = document.createElement('div');
                card.style.cssText = `
                    background: var(--card-bg);
                    padding: 10px 16px;
                    border-radius: var(--radius);
                    margin-bottom: 8px;
                    box-shadow: var(--card-shadow);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: none;
                `;

                const timeStr = tasks.map(t => t.time).sort().join(' & ');
                const freqLabel = tasks.length > 1 ? i18n.t('settings.twice_daily') : i18n.t('settings.once_daily');

                card.innerHTML = `
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; font-size: 1em; color: var(--title-color); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</div>
                        <div style="font-size: 0.85em; color: var(--meta-color);">
                            ${freqLabel} • ${timeStr}
                        </div>
                    </div>
                    <button class="icon-btn delete-task-btn" style="color: #ff4d4f; margin-left: 8px; width: 28px; height: 28px; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                `;

                // Delete logic
                card.querySelector('.delete-task-btn').onclick = async () => {
                    if (!await Modal.confirm(i18n.t('settings.confirm_delete_schedule'))) return;

                    // Remove these tasks from allSchedules
                    allSchedules = allSchedules.filter(t => !tasks.includes(t));

                    // Save immediately
                    try {
                        await fetch('/api/preferences', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${AuthManager.getToken()}`
                            },
                            body: JSON.stringify({
                                key: 'digest_schedules',
                                value: allSchedules
                            })
                        });
                        // Re-render
                        renderOtherTasks();
                    } catch (err) {
                        console.error("Delete failed", err);
                        await Modal.alert(i18n.t('ai.api_error'));
                    }
                };

                otherTasksList.appendChild(card);
            });
        };

        const updateFrequencyUI = () => {
            if (isTwiceDaily) {
                freqOnceBtn.classList.remove('active');
                freqTwiceBtn.classList.add('active');
                freqDesc.textContent = i18n.t('settings.twice_daily_desc'); // "Every 12 hours"
                secondTimePreview.style.display = 'block';
                updateSecondTimePreview();
            } else {
                freqTwiceBtn.classList.remove('active');
                freqOnceBtn.classList.add('active');
                freqDesc.textContent = i18n.t('settings.once_daily_desc'); // "Collect last 24h content"
                secondTimePreview.style.display = 'none';
            }
        };

        const updateSecondTimePreview = () => {
            if (!isTwiceDaily) return;
            const time = getPickerTime();
            const [h, m] = time.split(':').map(Number);
            const nextH = (h + 12) % 24;
            const nextTime = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            secondTimePreview.innerHTML = `${i18n.t('settings.second_run_at')} <strong>${nextTime}</strong> (+12h)`;
        };

        const setupTimePicker = (container, initialTime) => {
            let [initH, initM] = (initialTime || '08:00').split(':');

            // Round minutes to nearest 5
            let mVal = parseInt(initM, 10);
            mVal = Math.round(mVal / 5) * 5;
            if (mVal >= 60) {
                mVal = 0;
                // Ideally carry over hour, but simple clamp is fine for UI init sync
            }
            initM = String(mVal).padStart(2, '0');

            const hCol = container.querySelector('.hours-column');
            const mCol = container.querySelector('.minutes-column');
            const ITEM_HEIGHT = 40;

            const selectItem = (col, value, smooth = true) => {
                const items = Array.from(col.querySelectorAll('.time-item'));
                items.forEach(el => el.classList.remove('active'));
                const target = items.find(el => el.dataset.value === value) || items[0];
                target.classList.add('active');
                if (smooth) {
                    col.scrollTo({ top: items.indexOf(target) * ITEM_HEIGHT, behavior: 'smooth' });
                } else {
                    col.scrollTop = items.indexOf(target) * ITEM_HEIGHT;
                }
            };

            const handleScroll = (col) => {
                const scrollTop = col.scrollTop;
                const index = Math.round(scrollTop / ITEM_HEIGHT);
                const items = col.querySelectorAll('.time-item');
                if (items[index]) {
                    items.forEach(el => el.classList.remove('active'));
                    items[index].classList.add('active');
                    if (isTwiceDaily) updateSecondTimePreview();
                }
            };

            [hCol, mCol].forEach(col => {
                col.addEventListener('click', e => {
                    if (e.target.classList.contains('time-item')) {
                        selectItem(col, e.target.dataset.value);
                        if (isTwiceDaily) updateSecondTimePreview();
                    }
                });
                let scrollTimeout;
                col.addEventListener('scroll', () => {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => handleScroll(col), 100);
                });
            });

            // Init
            setTimeout(() => {
                selectItem(hCol, initH, false);
                selectItem(mCol, initM, false);
            }, 50);

            return () => {
                const h = hCol.querySelector('.active')?.dataset.value || '00';
                const m = mCol.querySelector('.active')?.dataset.value || '00';
                return `${h}:${m}`;
            };
        };

        // --- Events ---

        closeBtn.addEventListener('click', close);

        freqOnceBtn.addEventListener('click', () => { isTwiceDaily = false; updateFrequencyUI(); });
        freqTwiceBtn.addEventListener('click', () => { isTwiceDaily = true; updateFrequencyUI(); });

        enabledInput.addEventListener('change', () => {
            configArea.style.opacity = enabledInput.checked ? '1' : '0.5';
            configArea.style.pointerEvents = enabledInput.checked ? 'auto' : 'none';
        });

        manageOthersBtn.addEventListener('click', () => {
            form.style.display = 'none';
            otherSchedulesView.style.display = 'flex';
            renderOtherTasks();
        });

        backToMainBtn.addEventListener('click', () => {
            otherSchedulesView.style.display = 'none';
            form.style.display = 'block';
        });

        // Fetch
        // --- Load Data ---

        fetch('/api/preferences', {
            headers: { 'Authorization': `Bearer ${AuthManager.getToken()}` }
        })
            .then(res => res.json())
            .then(prefs => {
                allSchedules = prefs.digest_schedules || [];

                // Filter tasks for current scope
                const existingTasks = allSchedules.filter(t =>
                    t.scope === scope && String(t.scopeId || '') === String(scopeId || '')
                );

                // Determine initial state
                // If we have > 1 enabled task, or > 1 task total, assume Twice daily
                // Otherwise Once daily
                if (existingTasks.length > 1) {
                    isTwiceDaily = true;
                } else {
                    isTwiceDaily = false;
                }

                const firstTask = existingTasks[0];
                const initialTime = firstTask ? firstTask.time : '08:00';

                // Determine if enabled: if any task is enabled (or logic preference)
                const isEnabled = existingTasks.length > 0 && existingTasks.some(t => t.enabled);

                enabledInput.checked = isEnabled;

                configArea.style.opacity = enabledInput.checked ? '1' : '0.5';
                configArea.style.pointerEvents = enabledInput.checked ? 'auto' : 'none';

                getPickerTime = setupTimePicker(pickerContainer, initialTime);
                updateFrequencyUI();

                loader.style.display = 'none';
                form.style.display = 'block';
            })
            .catch(err => {
                console.error('Load error', err);
                loader.textContent = i18n.t('common.load_error');
            });

        // --- Save ---

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = i18n.t('settings.saving');
            msgEl.textContent = '';

            const time = getPickerTime();
            const isEnabled = enabledInput.checked;

            // Build new tasks
            const newTasks = [];

            if (isTwiceDaily) {
                // Task 1
                newTasks.push({
                    id: crypto.randomUUID(),
                    scope: scope,
                    scopeId: scopeId,
                    feedId: scope === 'feed' ? scopeId : null,
                    groupId: scope === 'group' ? scopeId : null,
                    time: time,
                    enabled: isEnabled,
                    hours: 12, // 12h range

                });
                // Task 2 (+12h)
                const [h, m] = time.split(':').map(Number);
                const nextH = (h + 12) % 24;
                const nextTime = `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                newTasks.push({
                    id: crypto.randomUUID(),
                    scope: scope,
                    scopeId: scopeId,
                    feedId: scope === 'feed' ? scopeId : null,
                    groupId: scope === 'group' ? scopeId : null,
                    time: nextTime,
                    enabled: isEnabled,
                    hours: 12, // 12h range

                });
            } else {
                // Task 1 (Once)
                newTasks.push({
                    id: crypto.randomUUID(),
                    scope: scope,
                    scopeId: scopeId,
                    feedId: scope === 'feed' ? scopeId : null,
                    groupId: scope === 'group' ? scopeId : null,
                    time: time,
                    enabled: isEnabled,
                    hours: 24, // 24h range for once daily

                });
            }

            // Merge with backend data
            // Remove OLD tasks for this scope
            const isMatch = (t) => {
                if (t.scope !== scope) return false;
                if (t.scopeId == scopeId) return true;
                return String(t.scopeId || '') === String(scopeId || '');
            };
            const otherTasks = allSchedules.filter(t => !isMatch(t));

            const finalTasks = [...otherTasks, ...newTasks];

            try {
                await fetch('/api/preferences', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AuthManager.getToken()}`
                    },
                    body: JSON.stringify({
                        key: 'digest_schedules',
                        value: finalTasks
                    })
                });
                msgEl.textContent = `✓ ${i18n.t('settings.save_success')}`;
                msgEl.style.color = '#52c41a';
                setTimeout(close, 1000);
            } catch (err) {
                console.error('Save error:', err);
                msgEl.textContent = i18n.t('ai.api_error');
                msgEl.style.color = '#ff4d4f';
                submitBtn.disabled = false;
                submitBtn.textContent = i18n.t('settings.save');
            }
        });
    }
};
