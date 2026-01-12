/**
 * 事件处理模块 - Tidyflux
 * @module events
 */


import { DOMElements } from '../dom.js';


// 下拉刷新
export function setupPullToRefresh() {
    // 简化版本，可以后续扩展
}

// 滑动手势
export function setupSwipeGesture() {
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = Math.abs(touchEndY - touchStartY);

        // 从左边缘向右滑动返回
        if (touchStartX < 30 && deltaX > 80 && deltaY < 100) {
            if (DOMElements.body.classList.contains('article-view-active')) {
                history.back();
            }
        }
    }, { passive: true });
}

export function setupListSwipeGesture() {
    // 列表页滑动手势
}



// 全局事件监听
export function setupEventListeners() {
    setupPullToRefresh();
    setupSwipeGesture();
    setupListSwipeGesture();

}
