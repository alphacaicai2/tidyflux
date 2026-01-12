/**
 * Tidyflux - 应用入口
 * @module main
 */

import { Router } from './modules/router.js'; // 导入以触发 Router.init() 自动执行
import { setupEventListeners } from './modules/events.js';
import { ViewManager } from './modules/view-manager.js';
import { AuthManager } from './modules/auth-manager.js';
import { initTheme } from './modules/theme-manager.js';
import { i18n } from './modules/i18n.js';
import { AIService } from './modules/ai-service.js';

async function initApp() {
    // 初始化主题（在登录页面也需要）
    initTheme();
    i18n.translatePage();

    // 检查登录状态
    if (!AuthManager.isLoggedIn()) {
        ViewManager.showAuthView();
        return;
    }

    // 初始化 AI 服务配置（从后端同步）
    await AIService.init();

    // 检查 Miniflux 配置
    try {
        const minifluxConfig = await AuthManager.getMinifluxConfig();
        console.log('Miniflux config:', minifluxConfig);
        if (!minifluxConfig.configured) {
            // 未配置 Miniflux，显示强制设置对话框
            console.log('Miniflux not configured, showing forced settings dialog');
            ViewManager._initSubModules();
            ViewManager.showSettingsDialog(true); // true = 强制模式
            return;
        }
    } catch (err) {
        console.error('Check Miniflux config failed:', err);
        // 检查失败也显示设置对话框
        ViewManager._initSubModules();
        ViewManager.showSettingsDialog(true);
        return;
    }

    // 初始化三栏布局
    await ViewManager.initThreeColumnLayout();

    Router.handleInitialHash();

    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', initApp);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {

    let isControlled = Boolean(navigator.serviceWorker.controller);

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');

                // 立即检查更新
                registration.update();

                // 每次页面可见时检查更新（针对移动端 PWA）
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        registration.update();
                    }
                });

                // 监听新 Service Worker 安装完成
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New ServiceWorker installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // 新 SW 已安装，旧 SW 仍在控制页面
                            console.log('New version available, activating...');
                            // 通知新 SW 立即接管
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });

    // 监听控制器变化，自动刷新页面
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isControlled) {
            // 首次安装后，标记下一次变化为受控状态（虽然通常此时页面也就结束了）
            isControlled = true;
            return;
        }

        if (refreshing) return;

        console.log('Controller changed, reloading page...');
        refreshing = true;
        window.location.reload();
    });
}
