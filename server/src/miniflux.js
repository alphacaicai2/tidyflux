import fetch from 'node-fetch';
import http from 'http';
import https from 'https';

//禁用 Keep-Alive 以避免 Premature close 错误
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

export class MinifluxClient {
    constructor(baseUrl, username, password, apiKey = null) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.apiKey = apiKey;
        this.token = null; // Basic Auth string

        // 选择 agent
        this.agent = this.baseUrl.startsWith('https') ? httpsAgent : httpAgent;
    }

    getAuthHeader() {
        if (this.apiKey) {
            return {
                'X-Auth-Token': this.apiKey,
                'Content-Type': 'application/json'
            };
        }

        if (!this.token) {
            this.token = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        }
        return {
            'Authorization': `Basic ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, options = {}, retries = 3) {
        const urlStr = `${this.baseUrl}/v1${endpoint}`;
        const url = new URL(urlStr);
        const requestModule = url.protocol === 'https:' ? https : http;

        const requestOptions = {
            method: options.method || 'GET',
            headers: {
                ...this.getAuthHeader(),
                ...options.headers
            },
            agent: this.agent, // 必须使用禁用 Keep-Alive 的 agent
            timeout: 30000
        };

        const postData = options.body;
        if (postData) {
            requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const makeRequest = () => {
            return new Promise((resolve, reject) => {
                const req = requestModule.request(url, requestOptions, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        const body = Buffer.concat(chunks).toString();

                        if (res.statusCode === 204) {
                            return resolve(null);
                        }

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                resolve(JSON.parse(body));
                            } catch (e) {
                                // 万一返回的不是 JSON (虽然应该都是)
                                resolve(body);
                            }
                        } else {
                            reject(new Error(`Miniflux API Error: ${res.statusCode} ${res.statusMessage} - ${body}`));
                        }
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error(`Request timeout: ${urlStr}`));
                });

                if (postData) {
                    req.write(postData);
                }
                req.end();
            });
        };

        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await makeRequest();
            } catch (error) {
                lastError = error;

                // 如果是认证错误 (401, 403)，不要重试
                if (error.message.includes('401') || error.message.includes('403')) {
                    throw error;
                }

                if (attempt === retries) {
                    console.error(`Miniflux request failed after ${retries + 1} attempts: ${endpoint}`, error.message);
                    throw lastError;
                }
                const delay = 500 * (attempt + 1);
                console.warn(`Miniflux request failed, retrying in ${delay}ms: ${endpoint} - ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Auth verification (by fetching current user)
    async me() {
        return this.request('/me');
    }

    // Feeds
    async getFeeds() {
        return this.request('/feeds');
    }

    async getFeed(feedId) {
        return this.request(`/feeds/${feedId}`);
    }

    // Get read/unread counters for all feeds
    async getCounters() {
        return this.request('/feeds/counters');
    }

    async createFeed(url, categoryId) {
        const body = { feed_url: url };
        if (categoryId) {
            body.category_id = categoryId;
        }
        return this.request('/feeds', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    async updateFeed(feedId, data) {
        return this.request(`/feeds/${feedId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async deleteFeed(feedId) {
        return this.request(`/feeds/${feedId}`, {
            method: 'DELETE'
        });
    }

    async refreshFeed(feedId) {
        return this.request(`/feeds/${feedId}/refresh`, {
            method: 'PUT'
        });
    }

    async refreshAllFeeds() {
        return this.request('/feeds/refresh', {
            method: 'PUT'
        });
    }

    // Entries (Articles)
    async getEntries(params = {}) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                query.append(key, value);
            }
        }
        return this.request(`/entries?${query.toString()}`);
    }

    async getEntry(entryId) {
        return this.request(`/entries/${entryId}`);
    }

    async updateEntry(entryId, data) {
        return this.request(`/entries/${entryId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // Update entry status (read/unread) - uses batch endpoint as required by Miniflux API
    async updateEntriesStatus(entryIds, status) {
        return this.request('/entries', {
            method: 'PUT',
            body: JSON.stringify({
                entry_ids: Array.isArray(entryIds) ? entryIds : [entryIds],
                status: status
            })
        });
    }

    async toggleBookmark(entryId) {
        return this.request(`/entries/${entryId}/bookmark`, {
            method: 'PUT'
        });
    }

    // Fetch original article content (Readability mode)
    async fetchEntryContent(entryId) {
        return this.request(`/entries/${entryId}/fetch-content?update_content=false`, {
            method: 'GET'
        });
    }

    // Categories (Groups)
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(title) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify({ title })
        });
    }

    async updateCategory(categoryId, title) {
        return this.request(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify({ title })
        });
    }

    async deleteCategory(categoryId) {
        return this.request(`/categories/${categoryId}`, {
            method: 'DELETE'
        });
    }

    // OPML
    async importOPML(xmlData) {
        // Miniflux API: POST /v1/import
        // Content-Type: application/xml
        // Body: The OPML content
        const url = `${this.baseUrl}/v1/import`;
        const authHeader = this.getAuthHeader();

        // We override content-type to application/xml
        const headers = {
            'Authorization': authHeader['Authorization'],
            'Content-Type': 'application/xml'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: xmlData
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Miniflux API Import Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return response.json();
    }

    async exportOPML() {
        // Miniflux API: GET /v1/export
        // Returns the OPML XML content directly
        const url = `${this.baseUrl}/v1/export`;
        const headers = this.getAuthHeader();

        const response = await fetch(url, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`Miniflux API Export Error: ${response.status}`);
        }

        return response.text();
    }
}
