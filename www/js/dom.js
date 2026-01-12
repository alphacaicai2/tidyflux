/**
 * DOM 元素引用模块 - Tidyflux
 * @module dom
 */

export const DOMElements = {
    body: document.body,
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    feedsPanel: document.getElementById('feeds-panel'),
    feedsList: document.getElementById('feeds-list'),
    articlesPanel: document.getElementById('articles-panel'),
    articlesList: document.getElementById('articles-list'),
    currentFeedTitle: document.getElementById('current-feed-title'),
    contentPanel: document.getElementById('content-panel'),
    articleContent: document.getElementById('article-content'),
    scrollToTopBtn: document.getElementById('scroll-to-top-btn'),
};

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}
