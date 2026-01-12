/**
 * Tidyflux - API 模块
 * @module api
 */

import { AuthManager } from './js/modules/auth-manager.js';

function authHeaders() {
    const token = AuthManager.getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

export function formatDate(dateString) {
    if (!dateString) return '未知日期';
    const date = new Date(dateString);
    if (isNaN(date)) return '无效日期';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

// 获取文章列表
export async function getArticleListPage(page = 1, feedId = null) {
    let url = `/api/articles?page=${page}&limit=50`;
    if (feedId) {
        url += `&feed_id=${feedId}`;
    }

    const response = await fetch(url, {
        headers: authHeaders()
    });

    if (!response.ok) {
        if (response.status === 401) {
            AuthManager.clearAuth();
            throw new Error('登录已过期');
        }
        throw new Error('获取文章失败');
    }

    return response.json();
}

// 获取文章详情
export async function getArticleDetail(articleId) {
    const response = await fetch(`/api/articles/${articleId}`, {
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('获取文章失败');
    }

    return response.json();
}

// 获取订阅列表
export async function getFeeds() {
    const response = await fetch('/api/feeds', {
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('获取订阅失败');
    }

    return response.json();
}

// 添加订阅
export async function addFeed(url) {
    const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || '添加订阅失败');
    }

    return data;
}

// 删除订阅
export async function deleteFeed(feedId) {
    const response = await fetch(`/api/feeds/${feedId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });

    if (!response.ok) {
        throw new Error('删除订阅失败');
    }

    return true;
}

// 刷新订阅
export async function refreshFeeds() {
    const response = await fetch('/api/feeds/refresh', {
        method: 'POST',
        headers: authHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || '刷新失败');
    }

    return data;
}

