/**
 * Digest Service - 简报生成
 *
 * 数据流（所选分组/订阅源 → 简报内容）：
 *
 * 1. 入参：DigestService.generate(miniflux, userId, options)
 *    - options.scope: 'all' | 'feed' | 'group'
 *    - options.feedId / options.groupId: 选定订阅源或分组（分组 = Miniflux category）
 *    - options.hours: 时间范围（12/24/72/168/0）
 *
 * 2. 拉取文章：getRecentUnreadArticles(miniflux, { hours, feedId, groupId })
 *    - 调用 miniflux.getEntries(params)，即 Miniflux API GET /entries
 *    - 参数：order=published_at, direction=desc, limit=500, status=unread(可选)
 *    - 限定范围：feed_id=xxx 或 category_id=xxx（分组对应 category_id），以及 after=时间戳（hours 内）
 *    - 返回：response.entries，每项为 Miniflux entry（含 id, title, content, url, published_at, feed: { title, category: { title } }）
 *
 * 3. 准备给模型的数据：prepareArticlesForDigest(articles)
 *    - 对每篇：取 article.content（正文 HTML）→ 去标签、截断至约 1000 token 作为 summary
 *    - 产出：{ index, title, feedTitle, categoryName, publishedAt, summary, url } 列表
 *
 * 4. 构建 Prompt：buildDigestPrompt(preparedArticles, { targetLang, scope: scopeName, customPrompt })
 *    - articlesList = 每篇文章格式化为：
 *      ### N. 标题
 *      - Source: 订阅源名
 *      - Category: 分组名（有则写）
 *      - Date: 发布时间
 *      - Link: 原文链接
 *      - Summary: 正文摘要（上一步的 summary，即来自该 entry 的 content）
 *    - 若用自定义提示词：替换 {{targetLang}}、{{content}}；{{content}} 被替换为「约束说明 + Article List + articlesList」
 *    - 若用默认提示词：同上，整段 prompt 里唯一的内容来源就是上述 articlesList
 *
 * 5. 调用 AI：callAIForDigest(prompt, aiConfig) 把最终 prompt 发给大模型，返回简报正文。
 *
 * 结论：传给模型的内容仅来自 Miniflux 在该次请求下返回的 entries（按分组/订阅源+时间筛选），
 * 每条的 Summary 来自该 entry 的 content 字段，无其它数据源。
 */
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

// 时间范围与小时的映射：0 表示“所有文章”，不设时间下限
const RANGE_HOURS = { 12: 12, 24: 24, 72: 72, 168: 168, 0: 0 };

// 辅助函数：获取最近文章（可选仅未读）
export async function getRecentUnreadArticles(miniflux, options) {
    const { hours = 12, limit, feedId, groupId, unreadOnly = true } = options;

    const effectiveHours = typeof hours === 'number' ? hours : RANGE_HOURS[hours] ?? 12;

    const entriesOptions = {
        order: 'published_at',
        direction: 'desc',
        limit: limit || 500
    };

    if (effectiveHours > 0) {
        const afterDate = new Date();
        afterDate.setHours(afterDate.getHours() - effectiveHours);
        entriesOptions.after = Math.floor(afterDate.getTime() / 1000);
    }
    // effectiveHours === 0 表示“所有文章”，不设置 after

    if (unreadOnly) {
        entriesOptions.status = 'unread';
    }

    console.log(`[Digest Debug] Fetching articles with options: limit=${entriesOptions.limit}, after=${entriesOptions.after ?? 'all'}, hours=${effectiveHours}, unreadOnly=${unreadOnly}`);

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

// 辅助函数：准备文章数据 (异步分批处理，避免阻塞事件循环)
async function prepareArticlesForDigest(articles) {
    const BATCH_SIZE = 20; // 每一批处理 20 篇文章
    const results = [];
    const maxTokens = 1000;

    // 安全截断长度：在执行昂贵的正则去标签前，先截断过长的文本
    const SAFE_CONTENT_LENGTH = 50000;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
        const batch = articles.slice(i, i + BATCH_SIZE);

        // 处理当前批次
        const processedBatch = batch.map((article, batchIndex) => {
            let content = article.content || '';

            // 1. 预先截断：防止超大字符串导致后续正则卡死
            if (content.length > SAFE_CONTENT_LENGTH) {
                content = content.substring(0, SAFE_CONTENT_LENGTH);
            }

            // 2. 去除 HTML 标签 (简单的去标签正则)
            // 替换所有标签为空格，替换连续空白为单个空格
            content = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

            return {
                index: i + batchIndex + 1,
                title: article.title,
                feedTitle: article.feed ? article.feed.title : '',
                feedId: article.feed_id ?? article.feed?.id ?? null,
                categoryName: article.feed?.category?.title || '',
                publishedAt: article.published_at,
                summary: truncateByToken(content, maxTokens),
                url: article.url
            };
        });

        results.push(...processedBatch);

        // 每处理完一批，让出事件循环 (yield to Event Loop)
        // 使用 setImmediate 如果环境支持，否则用 setTimeout 0
        if (i + BATCH_SIZE < articles.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return results;
}

// 构建简报生成的 prompt
function buildDigestPrompt(articles, options = {}) {
    let { targetLang = 'Simplified Chinese', scope = 'subscription', customPrompt } = options;

    // 迁移旧占位符并确保自定义 Prompt 包含 {{content}} 占位符
    if (customPrompt && customPrompt.trim()) {
        // 迁移旧格式占位符
        if (customPrompt.includes('{content}') && !customPrompt.includes('{{content}}')) {
            customPrompt = customPrompt.replace(/\{content\}/g, '{{content}}');
        }
        if (customPrompt.includes('{targetLang}') && !customPrompt.includes('{{targetLang}}')) {
            customPrompt = customPrompt.replace(/\{targetLang\}/g, '{{targetLang}}');
        }
        // 自动补全缺失的占位符
        if (!customPrompt.includes('{{content}}')) {
            customPrompt = customPrompt.trim() + '\n\n{{content}}';
        }
    }

    const articlesList = articles.map(a =>
        `### ${a.index}. ${a.title}\n` +
        `- Source: ${a.feedTitle}\n` +
        (a.categoryName ? `- Category: ${a.categoryName}\n` : '') +
        `- Date: ${a.publishedAt}\n` +
        (a.url ? `- Link: ${a.url}\n` : '') +
        `- Summary: ${a.summary}\n`
    ).join('\n');

    // 注入文章列表时始终带约束说明，减少模型使用订阅源外内容
    const contentBlock = `## CRITICAL: Use ONLY the information from the article list below. Do not add any facts or details from outside these articles.

## Article List (Total ${articles.length} articles):

${articlesList}`;

    let finalPrompt = '';

    if (customPrompt && customPrompt.trim()) {
        // 使用自定义提示词（替换 {{content}} 时同样带上约束）
        finalPrompt = customPrompt
            .replace(/\{\{targetLang\}\}/g, targetLang)
            .replace(/\{\{content\}\}/g, contentBlock);
    } else {
        // 默认提示词（明确禁止使用订阅源外的内容，避免幻觉）
        finalPrompt = `You are a professional news editor. Generate a concise digest based ONLY on the following list of recent ${scope} articles.

## CRITICAL CONSTRAINT:
- Use ONLY information from the article list below. Do not add any facts, events, or details from your training data or external knowledge.
- Every claim in your digest must be traceable to one of the listed articles. If something is not in the list, do not include it.

## Output Requirements:
1. Output in ${targetLang}
2. Start with a 2-3 sentence overview of the key content from these articles only
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

    const normalizeApiUrl = (url) => {
        let normalized = url.trim();
        if (!normalized.endsWith('/')) normalized += '/';
        if (!normalized.endsWith('chat/completions')) {
            normalized += 'chat/completions';
        }
        return normalized;
    };

    const apiUrl = normalizeApiUrl(aiConfig.apiUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 600000); // 10 minutes timeout

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: aiConfig.model || 'gpt-4.1-mini',
                temperature: aiConfig.temperature ?? 1,
                messages: [
                    { role: 'user', content: prompt }
                ],
                stream: false
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `AI API 错误: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } finally {
        clearTimeout(timeout);
    }
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
            aiConfig,
            unreadOnly = true,
            timezone = ''
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

        const fetchOptions = { hours, feedId, groupId, unreadOnly };
        const articles = await getRecentUnreadArticles(minifluxClient, fetchOptions);

        if (articles.length === 0) {
            const timeDesc = hours > 0
                ? (isEn ? `in the past ${hours} hours` : `在过去 ${hours} 小时内`)
                : (isEn ? 'in scope' : '范围内');
            const noArticlesMsg = isEn
                ? `No ${unreadOnly ? 'unread ' : ''}articles ${timeDesc}.`
                : `${timeDesc}没有${unreadOnly ? '未读' : ''}文章。`;
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
        const preparedArticles = await prepareArticlesForDigest(articles);

        // 构建 prompt
        const prompt = buildDigestPrompt(preparedArticles, {
            targetLang,
            scope: scopeName,
            customPrompt
        });

        // 调用 AI
        let digestContent = await callAIForDigest(prompt, aiConfig);

        // 文末追加本简报使用的订阅源清单（可点击跳转到该订阅源）
        const feedMap = new Map();
        for (const a of preparedArticles) {
            const id = a.feedId != null ? a.feedId : a.feedTitle;
            if (id != null && id !== '' && !feedMap.has(id)) {
                feedMap.set(id, { title: a.feedTitle || (isEn ? 'Feed' : '订阅源'), feedId: a.feedId });
            }
        }
        const feedList = Array.from(feedMap.values());
        if (feedList.length > 0) {
            const sectionTitle = isEn ? '## Feed Sources' : '## 订阅源清单';
            const lines = feedList
                .filter(f => f.feedId != null)
                .map(f => `- [${f.title.replace(/\]/g, '\\]')}](#/feed/${f.feedId})`)
                .join('\n');
            const fallbackLines = feedList
                .filter(f => f.feedId == null)
                .map(f => `- ${f.title}`)
                .join('\n');
            const appendix = lines
                ? (fallbackLines ? `${sectionTitle}\n\n${lines}\n${fallbackLines}` : `${sectionTitle}\n\n${lines}`)
                : (fallbackLines ? `${sectionTitle}\n\n${fallbackLines}` : '');
            if (appendix) {
                digestContent = (digestContent.trimEnd() + '\n\n---\n\n' + appendix).trim();
            }
        }

        // 生成本地化标题 — 使用用户设定的时区
        const now = new Date();
        let month, day, hh, mm;

        if (timezone) {
            try {
                const fmt = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                });
                const parts = Object.fromEntries(
                    fmt.formatToParts(now).map(p => [p.type, p.value])
                );
                month = parts.month;
                day = parts.day;
                hh = parts.hour.padStart(2, '0');
                mm = parts.minute.padStart(2, '0');
            } catch {
                // fallback to system timezone
            }
        }

        if (!month) {
            month = String(now.getMonth() + 1).padStart(2, '0');
            day = String(now.getDate()).padStart(2, '0');
            hh = String(now.getHours()).padStart(2, '0');
            mm = String(now.getMinutes()).padStart(2, '0');
        }

        const timeStr = `${month}-${day}-${hh}:${mm}`;

        // 时间范围标签（用于标题，便于区分）
        const rangeLabelsEn = { 12: 'Last 12h', 24: 'Last 24h', 72: 'Past 3d', 168: 'Past 7d', 0: 'All' };
        const rangeLabelsZh = { 12: '最近12小时', 24: '最近24小时', 72: '过去三天', 168: '过去7天', 0: '全部' };
        const h = hours === 0 || [12, 24, 72, 168].includes(hours) ? hours : 24;
        const rangeLabel = options.rangeLabel || (isEn ? (rangeLabelsEn[h] || `${h}h`) : (rangeLabelsZh[h] || `${h}小时`));

        const digestWord = isEn ? 'Digest' : '简报';
        const title = `${scopeName} · ${rangeLabel} · ${digestWord} ${timeStr}`;

        // 存储简报
        const saved = await DigestStore.add(userId, {
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
