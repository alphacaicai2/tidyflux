/**
 * 应用状态管理模块 - Tidyflux
 * @module state
 */

export const AppState = {
    // 用户状态
    isLoggedIn: false,

    // 订阅源列表
    feeds: [],
    groups: [],
    currentFeedId: null,
    currentGroupId: null,
    viewingFavorites: false,
    viewingDigests: false,
    preferences: {},

    // 文章列表
    articles: [],
    pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1
    },

    // 过滤状态
    showUnreadOnly: true,

    // 当前文章
    currentArticleId: null,

    // UI 状态
    lastVisitedArticleId: null,
    lastListViewScrollTop: null,

    // 搜索状态
    isSearchMode: false,
    searchQuery: '',
};

export const observers = {
    lazyLoad: null,
};
