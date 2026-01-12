/**
 * 工具函数模块 - Tidyflux
 * @module utils
 */

export function formatShortDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

export function safeIdForFilename(id) {
    if (!id) return '';
    return String(id).replace(/[^a-zA-Z0-9-_]/g, '_');
}
