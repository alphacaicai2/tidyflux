/**
 * Feed Manager Module
 * @module feed-manager
 */

import { AuthManager } from './auth-manager.js';
import { i18n } from './i18n.js';



export const FeedManager = {
    async getFeeds() {
        const response = await AuthManager.fetchWithAuth('/api/feeds');

        if (!response.ok) {
            // fetchWithAuth handles 401/403
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || i18n.t('feed.fetch_feeds_failed'));
        }

        return response.json();
    },

    async addFeed(url, groupId = null) {
        const body = { url };
        if (groupId) body.group_id = groupId;

        const response = await AuthManager.fetchWithAuth('/api/feeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.add_feed_failed'));
        }

        return data;
    },

    async getFeed(feedId) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/${feedId}`);

        if (!response.ok) {
            throw new Error(i18n.t('feed.fetch_feeds_failed'));
        }

        return response.json();
    },

    async updateFeed(feedId, updates) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/${feedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.update_feed_failed'));
        }

        return data;
    },

    async deleteFeed(feedId) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/${feedId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.delete_feed_failed'));
        }

        return true;
    },

    async refreshFeeds() {
        const response = await AuthManager.fetchWithAuth('/api/feeds/refresh', {
            method: 'POST'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.refresh_failed'));
        }

        return data;
    },

    async refreshFeed(feedId) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/refresh/${feedId}`, {
            method: 'POST'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.refresh_feed_failed'));
        }

        return data;
    },

    async refreshGroup(groupId) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/refresh-group/${groupId}`, {
            method: 'POST'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.refresh_group_failed'));
        }

        return data;
    },

    async getArticles(page = 1, feedId = null, groupId = null, unreadOnly = true, favorites = false, cursor = null) {
        let url = `/api/articles?page=${page}&limit=50&unread_only=${unreadOnly}`;

        // Use cursor pagination if provided
        if (cursor && cursor.publishedAt && cursor.id) {
            if (cursor.isAfter) {
                url += `&after_published_at=${encodeURIComponent(cursor.publishedAt)}&after_id=${cursor.id}`;
            } else {
                url += `&before_published_at=${encodeURIComponent(cursor.publishedAt)}&before_id=${cursor.id}`;
            }
        }

        if (favorites) {
            url += '&favorites=true';
        } else if (feedId) {
            url += `&feed_id=${feedId}`;
        } else if (groupId) {
            url += `&group_id=${groupId}`;
        }

        const response = await AuthManager.fetchWithAuth(url);

        if (!response.ok) {
            throw new Error(i18n.t('feed.fetch_articles_failed'));
        }

        return response.json();
    },

    async getArticle(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}`);

        if (!response.ok) {
            throw new Error(i18n.t('feed.fetch_articles_failed'));
        }

        return response.json();
    },

    async fetchEntryContent(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}/fetch-content`, {
            method: 'PUT'
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.fetch_content_failed'));
        }

        return response.json();
    },

    async markAsRead(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}/read`, {
            method: 'POST'
        });

        if (!response.ok) {
            console.error('Mark as read failed');
        }

        return response.ok;
    },

    async markAllAsRead(feedId = null, groupId = null) {
        const body = {};
        if (feedId) body.feed_id = feedId;
        if (groupId) body.group_id = groupId;

        const response = await AuthManager.fetchWithAuth('/api/articles/mark-all-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.mark_all_read_failed'));
        }

        return true;
    },

    async markAsUnread(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}/read`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Mark as unread failed');
            throw new Error(i18n.t('feed.mark_unread_failed'));
        }

        return true;
    },

    async favoriteArticle(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}/favorite`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.favorite_failed'));
        }

        return true;
    },

    async unfavoriteArticle(articleId) {
        const response = await AuthManager.fetchWithAuth(`/api/articles/${articleId}/favorite`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.unfavorite_failed'));
        }

        return true;
    },

    // Group management
    async getGroups() {
        const response = await AuthManager.fetchWithAuth('/api/groups');

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || i18n.t('feed.fetch_groups_failed'));
        }

        return response.json();
    },

    async addGroup(name) {
        const response = await AuthManager.fetchWithAuth('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('feed.create_group_failed'));
        }

        return data;
    },

    async updateGroup(groupId, updates) {
        const response = await AuthManager.fetchWithAuth(`/api/groups/${groupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.update_group_failed'));
        }

        return response.json();
    },

    async deleteGroup(groupId) {
        const response = await AuthManager.fetchWithAuth(`/api/groups/${groupId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.delete_group_failed'));
        }

        return true;
    },

    async updateFeedGroup(feedId, groupId) {
        const response = await AuthManager.fetchWithAuth(`/api/feeds/${feedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_id: groupId })
        });

        if (!response.ok) {
            throw new Error(i18n.t('feed.update_feed_failed'));
        }

        return response.json();
    },

    async importOpml(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const xmlContent = e.target.result;
                    const token = AuthManager.getToken(); // fetchWithAuth handles this, but here we need content-type xml
                    // Using fetchWithAuth for OPML import might need adjustment because of content-type
                    const response = await AuthManager.fetchWithAuth('/api/feeds/opml/import', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/xml'
                        },
                        body: xmlContent
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || i18n.t('feed.import_failed'));
                    }
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error(i18n.t('feed.read_file_failed')));
            reader.readAsText(file);
        });
    },

    async exportOpml() {
        const response = await AuthManager.fetchWithAuth('/api/feeds/opml/export');

        if (!response.ok) {
            throw new Error(i18n.t('feed.export_failed'));
        }

        return response.blob();
    },

    // Preferences
    async getPreferences() {
        const response = await AuthManager.fetchWithAuth('/api/preferences');

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || i18n.t('feed.fetch_preferences_failed'));
        }

        return response.json();
    },

    async setPreference(key, value) {
        const response = await AuthManager.fetchWithAuth('/api/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });

        if (!response.ok) {
            console.error('Save preference failed');
        }

        return response.ok;
    },

    // Search articles
    async searchArticles(query, page = 1) {
        const url = `/api/articles?page=${page}&limit=50&search=${encodeURIComponent(query)}`;

        const response = await AuthManager.fetchWithAuth(url);

        if (!response.ok) {
            throw new Error(i18n.t('feed.search_failed'));
        }

        return response.json();
    },

    // Get digests list
    async getDigests(options = {}) {
        const params = new URLSearchParams();
        if (options.scope) params.append('scope', options.scope);
        if (options.scopeId) params.append('scopeId', options.scopeId);
        if (options.unreadOnly) params.append('unreadOnly', 'true');

        const response = await AuthManager.fetchWithAuth(`/api/digest/list?${params.toString()}`);

        if (!response.ok) {
            throw new Error('获取简报列表失败');
        }

        return response.json();
    },

    // Get single digest
    async getDigest(digestId) {
        const response = await AuthManager.fetchWithAuth(`/api/digest/${digestId}`);

        if (!response.ok) {
            throw new Error('获取简报失败');
        }

        return response.json();
    },

    // Mark digest as read
    async markDigestAsRead(digestId) {
        const response = await AuthManager.fetchWithAuth(`/api/digest/${digestId}/read`, {
            method: 'POST'
        });

        return response.ok;
    },

    // Mark digest as unread
    async markDigestAsUnread(digestId) {
        const response = await AuthManager.fetchWithAuth(`/api/digest/${digestId}/read`, {
            method: 'DELETE'
        });

        return response.ok;
    },

    // Delete digest
    async deleteDigest(digestId) {
        const response = await AuthManager.fetchWithAuth(`/api/digest/${digestId}`, {
            method: 'DELETE'
        });

        return response.ok;
    },

};
