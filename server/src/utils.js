/**
 * 工具函数模块
 */

/**
 * 从 HTML 内容中提取第一张有效图片的 URL
 * @param {string} htmlContent - HTML 内容
 * @returns {string|null} - 图片 URL 或 null
 */
export function extractFirstImage(htmlContent) {
    if (!htmlContent) return null;

    // 解码 HTML 实体
    const decoded = htmlContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');

    // 检查是否是需要屏蔽的图片
    const blockedPatterns = [
        'grey-placeholder.png',
        'placeholder',
        'spacer.gif',
        'blank.gif',
        'pixel.gif',
        'tracking',
        'analytics',
        '1x1',
        'beacon'
    ];

    const isBlocked = (url) => {
        if (!url) return true;
        const lowerUrl = url.toLowerCase();
        return blockedPatterns.some(pattern => lowerUrl.includes(pattern));
    };

    // 检查图片尺寸是否过小
    const isTooSmall = (attrs) => {
        const widthMatch = attrs.match(/width\s*=\s*["']?(\d+)["']?/i);
        const heightMatch = attrs.match(/height\s*=\s*["']?(\d+)["']?/i);

        if (widthMatch && parseInt(widthMatch[1]) < 100) return true;
        if (heightMatch && parseInt(heightMatch[1]) < 100) return true;

        return false;
    };

    // 1. 尝试匹配完整的 img 标签
    const imgTagRegex = /<img\s+([^>]+)>/gi;
    let match;

    while ((match = imgTagRegex.exec(decoded)) !== null) {
        const attrs = match[1];

        // 提取 src
        let urlMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
        let url = urlMatch ? urlMatch[1] : null;

        // 如果没有 src，尝试 data-src
        if (!url) {
            urlMatch = attrs.match(/data-src\s*=\s*["']([^"']+)["']/i);
            url = urlMatch ? urlMatch[1] : null;
        }

        if (url && !url.startsWith('data:') && !isBlocked(url) && !isTooSmall(attrs)) {
            return url;
        }
    }

    // 2. 尝试匹配 figure/picture 中的图片
    match = decoded.match(/<(?:figure|picture)[^>]*>.*?<img[^>]+src\s*=\s*["']([^"']+)["']/is);
    if (match && match[1] && !match[1].startsWith('data:') && !isBlocked(match[1])) {
        return match[1];
    }

    // 3. 尝试匹配 srcset 中的第一个 URL
    match = decoded.match(/srcset\s*=\s*["']([^\s"']+)/i);
    if (match && match[1] && !isBlocked(match[1])) {
        return match[1];
    }

    // 4. 尝试匹配独立的图片 URL
    const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    while ((match = urlRegex.exec(decoded)) !== null) {
        const url = match[1];
        if (url && !isBlocked(url)) {
            return url;
        }
    }

    return null;
}

/**
 * 将原始图片 URL 转换为压缩后的缩略图 URL
 * 使用 wsrv.nl 图片代理服务
 * @param {string} originalUrl - 原始图片 URL
 * @returns {string|null} - 缩略图 URL 或 null
 */
export function getThumbnailUrl(originalUrl) {
    if (!originalUrl) return null;

    // 跳过 data: URL
    if (originalUrl.startsWith('data:')) return null;

    // 返回本地代理 URL，预设好尺寸参数
    // const encodedUrl = encodeURIComponent(originalUrl);
    // return `/api/proxy/image?url=${encodedUrl}&w=130&h=130`;

    // 直接返回原始 URL，由前端负责加载（减轻服务器压力）
    return originalUrl;
}

/**
 * 从 RSS 文章内容中提取并生成缩略图 URL
 * @param {string} content - 文章内容
 * @param {string} summary - 文章摘要
 * @returns {string|null} - 缩略图 URL 或 null
 */
export function extractThumbnailUrl(content, summary) {
    const imageUrl = extractFirstImage(content || summary || '');
    return getThumbnailUrl(imageUrl);
}
