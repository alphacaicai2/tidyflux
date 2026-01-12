
import en from '../locales/en.js';
import zh from '../locales/zh.js';

class I18n {
    constructor() {
        this.translations = { en, zh };

        // Priority: 1. Saved preference, 2. System language, 3. Default (zh)
        const savedLocale = localStorage.getItem('app_language');
        if (savedLocale && this.translations[savedLocale]) {
            this.locale = savedLocale;
        } else {
            const sysLang = navigator.language || navigator.userLanguage || '';
            this.locale = sysLang.startsWith('zh') ? 'zh' : 'en';
        }
    }

    get locale() {
        return this._locale;
    }

    set locale(lang) {
        if (this.translations[lang]) {
            this._locale = lang;
            localStorage.setItem('app_language', lang);
            document.documentElement.lang = lang;
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.locale];

        for (const k of keys) {
            value = value ? value[k] : undefined;
        }

        if (value === undefined) {
            // Fallback to English if not found in current locale
            if (this.locale !== 'en') {
                let fallbackValue = this.translations['en'];
                for (const k of keys) {
                    fallbackValue = fallbackValue ? fallbackValue[k] : undefined;
                }
                if (fallbackValue !== undefined) return this._interpolate(fallbackValue, params);
            }
            return key;
        }

        return this._interpolate(value, params);
    }

    _interpolate(str, params) {
        return str.replace(/{(\w+)}/g, (match, key) => {
            return typeof params[key] !== 'undefined' ? params[key] : match;
        });
    }

    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                el.setAttribute('placeholder', translation);
            } else if (el.tagName === 'META') {
                el.setAttribute('content', translation);
            } else if (el.hasAttribute('title')) {
                el.setAttribute('title', translation);
                // Also update text content if it's not a button with only icons
                if (el.textContent.trim() !== '' && !el.querySelector('svg')) {
                    el.textContent = translation;
                }
            } else {
                el.textContent = translation;
            }
        });
    }
}

export const i18n = new I18n();
