/**
 * ContextMenu - 上下文菜单模块
 * @module view/context-menu
 */

import { AppState } from '../../state.js';
import { FeedManager } from '../feed-manager.js';
import { showToast, createContextMenu } from './utils.js';
import { i18n } from '../../modules/i18n.js';
import { Modal } from './components.js';

/**
 * 上下文菜单管理
 */
// 模块级变量：跟踪 showArticlesContextMenu 的关闭处理器
let articlesMenuCloseHandler = null;

export const ContextMenu = {
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
     * 显示分组上下文菜单
     * @param {MouseEvent} event - 鼠标事件
     * @param {string|number} groupId - 分组 ID
     */
    showGroupContextMenu(event, groupId) {
        const group = AppState.groups.find(g => g.id == groupId);
        if (!group) return;

        const isPinned = this.viewManager.getPinnedGroups().includes(group.id);

        const html = `
            <div class="context-menu-item" data-action="toggle-pin" data-group-id="${groupId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M16 9V4l1 0V2H7v2l1 0v5L6 11v2h5v7l1 1 1-1v-7h5v-2l-2-2z"/>
                </svg>
                ${isPinned ? i18n.t('context.unpin_group') : i18n.t('context.pin_group')}
            </div>
            <div class="context-menu-item" data-action="refresh-group" data-group-id="${groupId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                ${i18n.t('context.refresh_group')}
            </div>

            <div class="context-menu-item" data-action="rename" data-group-id="${groupId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                ${i18n.t('context.rename')}
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" data-action="delete" data-group-id="${groupId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                ${i18n.t('context.delete_group')}
            </div>
        `;

        const { menu, cleanup } = createContextMenu(event, html);

        menu.addEventListener('click', async (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            const gid = item.dataset.groupId;
            cleanup();

            if (action === 'toggle-pin') {
                const pinned = this.viewManager.getPinnedGroups().includes(parseInt(gid, 10));
                await this.viewManager.togglePinGroup(gid, !pinned);
            } else if (action === 'refresh-group') {
                showToast(i18n.t('common.refreshing'));
                try {
                    await FeedManager.refreshGroup(gid);
                } catch (err) {
                    alert(err.message || i18n.t('common.refresh_failed'));
                }

            } else if (action === 'rename') {
                const newName = await Modal.prompt(i18n.t('context.enter_new_name'), group.name);
                if (newName && newName.trim() && newName !== group.name) {
                    await this.viewManager.renameGroup(gid, newName.trim());
                }
            } else if (action === 'delete') {
                if (await Modal.confirm(i18n.t('context.confirm_delete_group'))) {
                    await this.viewManager.deleteGroup(gid);
                }
            }
        });
    },

    /**
     * 显示订阅源上下文菜单
     * @param {MouseEvent} event - 鼠标事件
     * @param {string|number} feedId - 订阅源 ID
     */
    showFeedContextMenu(event, feedId) {


        const html = `
            <div class="context-menu-item" data-action="refresh" data-feed-id="${feedId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                ${i18n.t('context.refresh_feed')}
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="edit-feed" data-feed-id="${feedId}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
                </svg>
                ${i18n.t('dialogs.edit_subscription')}
            </div>
        `;

        const { menu, cleanup } = createContextMenu(event, html);

        menu.addEventListener('click', async (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            const fid = item.dataset.feedId;
            cleanup();

            if (action === 'refresh') {
                showToast(i18n.t('common.refreshing'));
                try {
                    await FeedManager.refreshFeed(fid);
                } catch (err) {
                    alert(err.message || i18n.t('common.refresh_failed'));
                }

            } else if (action === 'edit-feed') {
                this.viewManager.showEditFeedDialog(fid);
            }
        });
    },

    /**
     * 显示文章列表上下文菜单
     * @param {MouseEvent} event - 鼠标事件
     */
    showArticlesContextMenu(event) {
        const isUnreadOnly = AppState.showUnreadOnly;
        const isFavorites = AppState.viewingFavorites;
        const isDigests = AppState.viewingDigests;

        let itemsHtml = '';

        if (!isFavorites && !isDigests) {
            itemsHtml += `
            <div class="context-menu-item" data-action="refresh">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                ${i18n.t('context.refresh_feed')}
            </div>
            <div class="context-menu-item" data-action="generate-digest">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                ${i18n.t('digest.generate')}
            </div>
            <div class="context-menu-item" data-action="schedule-digest">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    <path d="M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM12.5 8H11v6l4.75 2.85.75-1.23-4-2.37V8zM12 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
                ${i18n.t('ai.scheduled_digest')}
            </div>
            <div class="context-menu-item" data-action="mark-all-read">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                     <path d="M9 16.17L4.83 12l-1.41 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                ${i18n.t('context.mark_all_read')}
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="toggle-view">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    ${isUnreadOnly
                    ? '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
                    : '<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.89-2-2-2z"/>'}
                </svg>
                ${i18n.t('context.show_unread')}
            </div>
`;
        }

        if (itemsHtml !== '') {
            itemsHtml += '<div class="context-menu-divider"></div>';
        }

        itemsHtml += `
            <div class="context-menu-label" style="color: var(--text-tertiary); font-size: 11px; font-weight: 600; padding: 10px 16px 4px; cursor: default; text-transform: uppercase; letter-spacing: 0.5px;">
                ${i18n.t('common.global_settings')}
            </div>
            <div class="context-menu-item" data-action="toggle-scroll-read">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    ${AppState.preferences?.scroll_mark_as_read
                ? '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
                : '<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.89-2-2-2z"/>'}
                </svg>
                ${i18n.t('context.scroll_mark_read')}
            </div>
            <div class="context-menu-item" data-action="toggle-thumbnails">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right: 8px;">
                    ${AppState.preferences?.show_thumbnails !== false
                ? '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
                : '<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.89-2-2-2z"/>'}
                </svg>
                ${i18n.t('context.show_thumbnails')}
            </div>
`;

        const html = itemsHtml;


        // 使用按钮位置定位
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();

        // 清理旧的菜单和事件监听器
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
        if (articlesMenuCloseHandler) {
            document.removeEventListener('click', articlesMenuCloseHandler, true);
            articlesMenuCloseHandler = null;
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = html;
        document.body.appendChild(menu);

        const actualWidth = menu.offsetWidth;
        let x = rect.right - actualWidth;
        const y = rect.bottom + 10;

        if (x + actualWidth > window.innerWidth) {
            x = window.innerWidth - actualWidth - 10;
        }

        if (x < 10) x = 10; // 确保不会超出左边界

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                menu.remove();
                document.removeEventListener('click', closeHandler, true);
                articlesMenuCloseHandler = null;
            }
        };
        articlesMenuCloseHandler = closeHandler;
        setTimeout(() => document.addEventListener('click', closeHandler, true), 0);

        menu.addEventListener('click', async (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item || item.classList.contains('disabled')) return;

            const action = item.dataset.action;
            menu.remove();
            document.removeEventListener('click', closeHandler, true);
            articlesMenuCloseHandler = null;

            if (action === 'refresh') {
                showToast(i18n.t('common.refreshing'));
                try {
                    if (AppState.currentFeedId) {
                        await FeedManager.refreshFeed(AppState.currentFeedId);
                    } else if (AppState.currentGroupId) {
                        await FeedManager.refreshGroup(AppState.currentGroupId);
                    } else {
                        await FeedManager.refreshFeeds();
                    }
                } catch (err) {
                    alert(err.message || i18n.t('common.refresh_failed'));
                }
            } else if (action === 'generate-digest') {
                if (AppState.currentFeedId) {
                    this.viewManager.generateDigestForFeed(AppState.currentFeedId);
                } else if (AppState.currentGroupId) {
                    this.viewManager.generateDigestForGroup(AppState.currentGroupId);
                } else {
                    this.viewManager.generateDigest('all');
                }
            } else if (action === 'schedule-digest') {
                this.viewManager.showDigestScheduleDialog({
                    feedId: AppState.currentFeedId,
                    groupId: AppState.currentGroupId
                });
            } else if (action === 'mark-all-read') {
                if (await Modal.confirm(i18n.t('context.confirm_mark_all_read'))) {
                    await FeedManager.markAllAsRead(AppState.currentFeedId, AppState.currentGroupId);
                    await this.viewManager.loadArticles(AppState.currentFeedId, AppState.currentGroupId);
                    await this.viewManager.loadFeeds();
                }
            } else if (action === 'toggle-view') {
                AppState.showUnreadOnly = !AppState.showUnreadOnly;
                if (AppState.currentFeedId) {
                    await this.viewManager.saveFilterSetting(`feed_${AppState.currentFeedId}`, AppState.showUnreadOnly);
                } else if (AppState.currentGroupId) {
                    await this.viewManager.saveFilterSetting(`group_${AppState.currentGroupId}`, AppState.showUnreadOnly);
                } else if (!AppState.viewingFavorites) {
                    await this.viewManager.saveFilterSetting('all', AppState.showUnreadOnly);
                }
                await this.viewManager.loadArticles(AppState.currentFeedId, AppState.currentGroupId);
            } else if (action === 'toggle-scroll-read') {
                const newState = !AppState.preferences?.scroll_mark_as_read;
                AppState.preferences = AppState.preferences || {};
                AppState.preferences.scroll_mark_as_read = newState;

                try {
                    await FeedManager.setPreference('scroll_mark_as_read', newState);
                    showToast(newState ? i18n.t('context.scroll_read_on') : i18n.t('context.scroll_read_off'), 3000, false);
                } catch (err) {
                    console.error('Save pref error:', err);
                }
            } else if (action === 'toggle-thumbnails') {
                const currentState = AppState.preferences?.show_thumbnails !== false;
                const newState = !currentState;
                AppState.preferences = AppState.preferences || {};
                AppState.preferences.show_thumbnails = newState;

                try {
                    await FeedManager.setPreference('show_thumbnails', newState);
                    showToast(newState ? i18n.t('context.thumbnails_on') : i18n.t('context.thumbnails_off'), 3000, false);
                    // 刷新文章列表以应用更改
                    await this.viewManager.loadArticles(AppState.currentFeedId, AppState.currentGroupId);
                } catch (err) {
                    console.error('Save pref error:', err);
                }
            }
        });
    }
};
