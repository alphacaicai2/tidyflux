/**
 * Authentication Manager Module
 * @module auth-manager
 */

import { i18n } from './i18n.js';

const AUTH_TOKEN_KEY = 'tinyflux_token';
const AUTH_USER_KEY = 'tinyflux_user';

export const AuthManager = {
    getToken() {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    },

    getUser() {
        const user = localStorage.getItem(AUTH_USER_KEY);
        return user ? JSON.parse(user) : null;
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    setAuth(token, user) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    },

    clearAuth() {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
    },

    async register(email, password) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.register_failed'));
        }

        this.setAuth(data.token, data.user);
        return data.user;
    },

    async login(username, password) {
        // Send credentials to backend
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.login_failed'));
        }

        this.setAuth(data.token, data.user);
        return data.user;
    },

    async fetchWithAuth(url, options = {}) {
        const token = this.getToken();
        const headers = {
            ...options.headers,
            'Authorization': token ? `Bearer ${token}` : ''
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            console.warn('Session expired or forbidden. Logging out...');
            this.clearAuth();
            window.location.reload();
            // Create a never-resolving promise to halt further execution while reloading
            return new Promise(() => { });
        }

        return response;
    },

    async changePassword(newPassword) {
        const response = await this.fetchWithAuth('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newPassword })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.password_change_failed'));
        }
        return true;
    },

    async getMinifluxConfig() {
        const response = await this.fetchWithAuth('/api/auth/miniflux-config');

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.config_fetch_failed'));
        }
        return data;
    },

    async getMinifluxStatus() {
        // Status check should be resilient, but if 401 occurs, fetchWithAuth handles it.
        const response = await this.fetchWithAuth('/api/auth/miniflux-status');

        const data = await response.json();
        if (!response.ok) {
            // silent fail or return structure
            return { connected: false, error: data.error };
        }
        return data;
    },

    async saveMinifluxConfig(url, username, password, apiKey, authType) {
        const response = await this.fetchWithAuth('/api/auth/miniflux-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, username, password, apiKey, authType })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.config_save_failed'));
        }
        return data;
    },

    async testMinifluxConnection(url, username, password, apiKey, authType) {
        const response = await this.fetchWithAuth('/api/auth/miniflux-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, username, password, apiKey, authType })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || i18n.t('auth.connection_test_failed'));
        }
        return data;
    },

    logout() {
        this.clearAuth();
        window.location.reload();
    }
};
