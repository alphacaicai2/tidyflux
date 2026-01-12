import fetch from 'node-fetch';
import { DigestStore } from '../utils/digest-store.js';

// 截取文本辅助函数
// 按 Token 估算截取文本 (1 CJK char ≈ 1 token, 4 non-CJK chars ≈ 1 token)
function truncateByToken(text, maxTokens) {
    if (!text) return '';

    let accTokens = 0;
    let cutIndex = 0;
    const len = text.length;

    for (let i = 0; i < len; i++) {
        const code = text.charCodeAt(i);
        // CJK 字符范围估算 (更精确的 Token 消耗估算)
        // 中文通常 1 字 ≈ 1.5-2 Token，英文 1 词 ≈ 1.3 Token (约 4 字符)
        if (code >= 0x4E00 && code <= 0x9FFF) {
            accTokens += 1.6; // 约 625 中文字符
        } else {
            accTokens += 0.3; // 约 3300 英文字符 (约 700 单词)
        }

        if (accTokens >= maxTokens) {
            cutIndex = i;
            return text.substring(0, cutIndex) + '...';
        }
    }

    return text;
}

// 辅助函数：获取最近未读文章
async function getRecentUnreadArticles(miniflux, options) {
    const { hours = 12, limit, feedId, groupId } = options;

    const afterDate = new Date();
    afterDate.setHours(afterDate.getHours() - hours);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    const entriesOptions = {
        status: 'unread',
        order: 'published_at',
        direction: 'desc',
        limit: limit || 500,
        after: afterTimestamp
    };

    console.log(`[Digest Debug] Fetching articles with options: limit=${entriesOptions.limit}, after=${entriesOptions.after} (${hours} hours ago)`);

    if (feedId) entriesOptions.feed_id = parseInt(feedId);
    if (groupId) entriesOptions.category_id = parseInt(groupId);

    try {
        const response = await miniflux.getEntries(entriesOptions);
        return response.entries || [];
    } catch (error) {
        console.error('Fetch entries error:', error);
        throw error;
    }
}

// 辅助函数：准备文章数据
function prepareArticlesForDigest(articles) {
    return articles.map((article, index) => {
        // ... (原逻辑)
        // 简化内容：去除 HTML 标签，截取长度
        let content = article.content || '';
        // 简单的去标签正则 (更健壮的方式是用 cheerio 或类似库，但这里保持简单)
        content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        // 限制每篇文章的摘要长度，目标 1000 Tokens
        const maxTokens = 1000;

        return {
            index: index + 1,
            title: article.title,
            feedTitle: article.feed ? article.feed.title : '',
            publishedAt: article.published_at,
            summary: truncateByToken(content, maxTokens),
            url: article.url
        };
    });
}

// 构建简报生成的 prompt
function buildDigestPrompt(articles, options = {}) {
    let { targetLang = 'Simplified Chinese', scope = 'subscription', customPrompt } = options;

    // 确保自定义 Prompt 包含 {content} 占位符
    if (customPrompt && customPrompt.trim() && !customPrompt.includes('{content}')) {
        customPrompt = customPrompt.trim() + '\n\n{content}';
    }

    const articlesList = articles.map(a =>
        `### ${a.index}. ${a.title}\n` +
        `- Source: ${a.feedTitle}\n` +
        `- Date: ${a.publishedAt}\n` +
        `- Summary: ${a.summary}\n`
    ).join('\n');


    let finalPrompt = '';

    if (customPrompt && customPrompt.trim()) {
        // 使用自定义提示词
        finalPrompt = customPrompt
            .replace(/\{targetLang\}/g, targetLang)
            .replace(/\{content\}/g, `## Article List (Total ${articles.length} articles):\n\n${articlesList}`);
    } else {
        // 默认提示词
        finalPrompt = `You are a professional news editor. Please generate a concise digest based on the following list of recent ${scope} articles.

## Output Requirements:
1. Output in ${targetLang}
2. Start with a 2-3 sentence overview of today's/recent key content
3. Categorize by topic or importance, listing key information in concise bullet points
4. If multiple articles relate to the same topic, combine them
5. Keep the format concise and compact, using Markdown
6. Output the content directly, no opening remarks like "Here is the digest"

## Article List (Total ${articles.length} articles):

${articlesList}`;
    }

    return finalPrompt;
}

// 调用 AI API 生成简报
async function callAIForDigest(prompt, aiConfig) {
    if (!aiConfig || !aiConfig.apiUrl || !aiConfig.apiKey) {
        throw new Error('AI 未配置，请先在设置中配置 AI API');
    }

    let apiUrl = aiConfig.apiUrl.trim();
    if (!apiUrl.endsWith('/')) apiUrl += '/';
    if (!apiUrl.endsWith('chat/completions')) {
        apiUrl += 'chat/completions';
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
            model: aiConfig.model || 'gpt-4.1-mini',
            messages: [
                { role: 'user', content: prompt }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `AI API 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export const DigestService = {
    async generate(minifluxClient, userId, options) {
        const {
            scope = 'all',
            feedId,
            groupId,
            hours = 12,
            targetLang = 'Simplified Chinese',
            prompt: customPrompt,
            aiConfig
        } = options;

        const isEn = targetLang && (targetLang.toLowerCase().includes('english') || targetLang.toLowerCase().includes('en'));

        // 获取 Scope 名称（需要 Miniflux Client）
        let scopeName = isEn ? 'All Subscriptions' : '全部订阅';
        let scopeId = null;

        if (scope === 'feed' && feedId) {
            scopeId = parseInt(feedId);
            const feeds = await minifluxClient.getFeeds();
            const feed = feeds.find(f => f.id === parseInt(feedId));
            scopeName = feed ? feed.title : (isEn ? 'Feed' : '订阅源');
        } else if (scope === 'group' && groupId) {
            scopeId = parseInt(groupId);
            const categories = await minifluxClient.getCategories();
            const category = categories.find(c => c.id === parseInt(groupId));
            scopeName = category ? category.title : (isEn ? 'Group' : '分组');
        }

        const fetchOptions = { hours, feedId, groupId };
        const articles = await getRecentUnreadArticles(minifluxClient, fetchOptions);

        if (articles.length === 0) {
            const noArticlesMsg = isEn
                ? `No unread articles in the past ${hours} hours.`
                : `在过去 ${hours} 小时内没有未读文章。`;
            return {
                success: true,
                digest: {
                    id: null,
                    content: noArticlesMsg,
                    articleCount: 0,
                    scope: scopeName,
                    generatedAt: new Date().toISOString()
                }
            };
        }

        // 准备文章数据
        const preparedArticles = prepareArticlesForDigest(articles);

        // 构建 prompt
        const prompt = buildDigestPrompt(preparedArticles, {
            targetLang,
            scope: scopeName,
            customPrompt
        });

        // 调用 AI
        const digestContent = await callAIForDigest(prompt, aiConfig);

        // 生成本地化标题
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${month}-${day}-${hh}:${mm}`;

        const digestWord = isEn ? 'Digest' : '简报';
        const title = `${scopeName} · ${digestWord} ${timeStr}`;

        // 存储简报
        const saved = DigestStore.add(userId, {
            scope,
            scopeId,
            scopeName,
            title,
            content: digestContent,
            articleCount: preparedArticles.length,
            hours
        });

        return {
            success: true,
            digest: saved
        };
    }
};
