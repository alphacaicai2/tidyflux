/**
 * Gestures - 手势交互模块
 * @module view/gestures
 */

import { DOMElements } from '../../dom.js';
import { AppState } from '../../state.js';

/**
 * 手势处理模块
 */
export const Gestures = {
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
     * 显示指定面板
     * @param {string} panel - 面板名称: 'feeds', 'articles', 'content'
     */
    showPanel(panel) {
        const panels = {
            feeds: DOMElements.feedsPanel,
            articles: DOMElements.articlesPanel,
            content: DOMElements.contentPanel
        };

        // 如果不是程序控制的导航（即系统返回手势等），禁用动画以避免与浏览器原生手势冲突导致抖动
        const isProgrammatic = this.viewManager?.isProgrammaticNav || false;
        if (!isProgrammatic) {
            Object.values(panels).forEach(p => {
                if (p) p.classList.add('no-transition');
            });
        }

        Object.values(panels).forEach(p => {
            if (p) p.classList.remove('active');
        });

        if (panels[panel]) {
            panels[panel].classList.add('active');
        }

        // 处理从文章列表进入内容页的过渡动画
        if (panel === 'content') {
            if (panels.articles) panels.articles.classList.add('move-left');
        } else {
            if (panels.articles) panels.articles.classList.remove('move-left');
        }

        // 移除 no-transition 类（如果之前添加的话）
        if (!isProgrammatic) {
            // 强制重排以应用无动画状态
            void panels.feeds?.offsetWidth;
            Object.values(panels).forEach(p => {
                if (p) p.classList.remove('no-transition');
            });
        }

        // 重置标志
        if (this.viewManager) {
            this.viewManager.isProgrammaticNav = false;
        }

        // 更新 body class 用于 CSS
        document.body.classList.remove('panel-feeds', 'panel-articles', 'panel-content');
        document.body.classList.add(`panel-${panel}`);
    },

    /**
     * 检查元素是否在水平可滚动容器内
     * @param {HTMLElement} element - 目标元素
     * @returns {boolean}
     */
    isInHorizontalScrollableContainer(element) {
        let current = element;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const overflowX = style.overflowX;
            if ((overflowX === 'auto' || overflowX === 'scroll') && current.scrollWidth > current.clientWidth) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    },

    /**
     * 检查是否有文本选中
     * @returns {boolean}
     */
    hasTextSelection() {
        const selection = window.getSelection();
        return selection && selection.toString().length > 0;
    },

    /**
     * 绑定滑动手势
     */
    bindSwipeGestures() {
        if (window.innerWidth > 1024) return;

        const vm = this.viewManager;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isSwiping = false;
        let isHorizontalSwipe = false;
        let startPanel = null;
        let swipeTarget = null;

        const SWIPE_THRESHOLD = 50;
        const EDGE_SIZE = 25;
        const VELOCITY_THRESHOLD = 0.3;

        let startTime = 0;

        const getActivePanel = () => {
            if (DOMElements.contentPanel?.classList.contains('active')) return 'content';
            if (DOMElements.articlesPanel?.classList.contains('active')) return 'articles';
            return 'feeds';
        };

        const handleTouchStart = (e) => {
            if (this.hasTextSelection()) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            currentX = startX;
            startTime = Date.now();
            isSwiping = false;
            isHorizontalSwipe = false;
            startPanel = getActivePanel();
            swipeTarget = e.target;
            this.isFromLeftEdge = startX < EDGE_SIZE;

            // 检查是否在可水平滚动的容器内
            if (this.isInHorizontalScrollableContainer(swipeTarget)) {
                return;
            }
        };

        const handleTouchMove = (e) => {
            if (!startX) return;

            const touch = e.touches[0];
            const diffX = touch.clientX - startX;
            const diffY = touch.clientY - startY;

            // 确定是水平还是垂直滑动
            if (!isSwiping && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
                isSwiping = true;
                isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);

                if (!isHorizontalSwipe) {
                    startX = 0;
                    return;
                }
            }

            if (!isHorizontalSwipe) return;

            currentX = touch.clientX;

            // 差异化拦截默认行为：
            // 1. 如果是从左边缘开始的滑动，不要 preventDefault，允许 iOS Safari 触发系统原生返回手势
            // 2. 如果不是从边缘开始，必须 preventDefault，否则 Android Chrome 会在滑动结束后锁定点击事件几百毫秒
            if (this.isFromLeftEdge) {
                return;
            }

            if (e.cancelable) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = () => {
            if (!isHorizontalSwipe || !startX) {
                startX = 0;
                return;
            }

            const diffX = currentX - startX;
            const elapsed = Date.now() - startTime;
            const velocity = Math.abs(diffX) / elapsed;

            const isSwipeRight = diffX > SWIPE_THRESHOLD || (diffX > 20 && velocity > VELOCITY_THRESHOLD);
            const isSwipeLeft = diffX < -SWIPE_THRESHOLD || (diffX < -20 && velocity > VELOCITY_THRESHOLD);

            const isFromLeftEdge = startX < EDGE_SIZE;
            const isFromRightEdge = startX > window.innerWidth - EDGE_SIZE;

            if (startPanel === 'content') {
                // 内容页右滑返回：
                // 1. 边缘滑动：放行不处理，让浏览器执行原生返回 (触发 router)
                // 2. 中间滑动：执行手动返回
                if (!isFromLeftEdge && isSwipeRight) {
                    if (this.viewManager) this.viewManager.isProgrammaticNav = true;
                    // Removed: this.showPanel('articles'); (Let Router handle it)

                    // 同步 URL
                    if (this.viewManager) {
                        this.viewManager.isProgrammaticNav = true;
                        history.back();
                    }

                    // 恢复滚动位置
                    if (AppState.lastListViewScrollTop !== null) {
                        if (vm.useVirtualScroll && vm.virtualList) {
                            vm.virtualList.setScrollTop(AppState.lastListViewScrollTop);
                        } else if (DOMElements.articlesList) {
                            DOMElements.articlesList.scrollTop = AppState.lastListViewScrollTop;
                        }
                    }
                }
            } else if (startPanel === 'articles') {
                if ((isFromLeftEdge && isSwipeRight) || isSwipeRight) {
                    // 保存当前列表滚动位置，以便从 feeds 返回时恢复
                    if (DOMElements.articlesList) {
                        if (vm && vm.useVirtualScroll && vm.virtualList) {
                            AppState.lastListViewScrollTop = vm.virtualList.getScrollTop();
                        } else {
                            AppState.lastListViewScrollTop = DOMElements.articlesList.scrollTop;
                        }
                    }

                    // 返回订阅源列表
                    // 如果可以通过 history.back() 回到 feeds 列表则回退，否则 explicit navigate
                    // 由于我们现在有了明确的 #/feeds 路由
                    // 如果当前就是 #/all (文章列表)，去 #/feeds
                    if (this.viewManager) this.viewManager.isProgrammaticNav = true;
                    window.location.hash = '#/feeds';
                } else if ((isFromRightEdge && isSwipeLeft) || isSwipeLeft) {
                    // 如果有当前文章，进入内容页
                    // 使用 selectArticle 而不是单纯 showPanel，以确保 URL 同步更新
                    // 这样再次右滑返回时，history.back() 才能正确返回列表页
                    if (AppState.currentArticleId) {
                        if (this.viewManager && this.viewManager.selectArticle) {
                            this.viewManager.selectArticle(AppState.currentArticleId);
                        } else {
                            this.showPanel('content');
                        }
                    }
                }
            } else if (startPanel === 'feeds') {
                if ((isFromRightEdge && isSwipeLeft) || isSwipeLeft) {
                    // 进入文章列表
                    if (this.viewManager) this.viewManager.isProgrammaticNav = true;
                    // Removed: this.showPanel('articles'); (Let Router handle it)

                    // 同步 URL (退出 feeds 面板)
                    if (this.viewManager) {
                        this.viewManager.isProgrammaticNav = true;
                        history.back();
                    }
                }
            }

            startX = 0;
            startY = 0;
            currentX = 0;
            isSwiping = false;
            isHorizontalSwipe = false;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
};
