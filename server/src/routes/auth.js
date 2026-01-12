import express from 'express';
import { generateToken, authenticateToken, clearMinifluxClientCache, getMinifluxClient } from '../middleware/auth.js';
import { UserStore } from '../utils/user-store.js';
import { MinifluxConfigStore } from '../utils/miniflux-config-store.js';
import { MinifluxClient } from '../miniflux.js';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

async function validateMinifluxUrl(urlString) {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('Use http or https');
        }

        // Resolve hostname to IP
        const { address } = await dnsLookup(url.hostname);

        // Block Link-Local addresses (AWS/Cloud metadata)
        if (address.startsWith('169.254.')) {
            throw new Error('Access to Link-Local addresses is forbidden');
        }

        // Allow private IPs (10.x, 192.168.x, 127.x) for self-hosted usage

    } catch (error) {
        if (error.code === 'ENOTFOUND') {
            throw new Error('Cannot resolve hostname');
        }
        throw error;
    }
}
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '请填写完整信息' });
        }

        // Validate against local UserStore
        const user = UserStore.authenticate(username, password);

        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // Check if Miniflux is configured (env or manual)
        const safeConfig = MinifluxConfigStore.getSafeConfig();

        const token = generateToken({
            id: user.username,
            username: user.username,
            type: 'local'
        });

        res.json({
            user: {
                id: user.username,
                username: user.username,
                email: '',
                minifluxConfigured: safeConfig.configured
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Miniflux 模式不支持注册，请直接登录' });
});

// Change Password
router.post('/change-password', authenticateToken, (req, res) => {
    try {
        const { newPassword } = req.body;
        const username = req.user.username;

        UserStore.changePassword(username, newPassword);
        res.json({ success: true, message: '密码修改成功' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: '密码修改失败' });
    }
});

// Get Miniflux config (safe info only)
router.get('/miniflux-config', authenticateToken, (req, res) => {
    const safeConfig = MinifluxConfigStore.getSafeConfig();
    const envConfigured = MinifluxConfigStore.isEnvConfigured();

    res.json({
        ...safeConfig,
        envConfigured // 是否通过环境变量配置
    });
});

// Check connection status of current config
router.get('/miniflux-status', authenticateToken, async (req, res) => {
    try {
        const config = MinifluxConfigStore.getConfig();
        if (!config) {
            return res.json({ connected: false, error: '未配置' });
        }

        try {
            const client = new MinifluxClient(config.url, config.username, config.password, config.apiKey);
            await client.request('/me');
            res.json({ connected: true });
        } catch (err) {
            res.json({ connected: false, error: err.message });
        }
    } catch (error) {
        console.error('Status check failed:', error);
        res.status(500).json({ error: '状态检查失败' });
    }
});

// Save Miniflux manual config
// Save Miniflux manual config
router.post('/miniflux-config', authenticateToken, async (req, res) => {
    try {
        const { url, username, password, apiKey, authType } = req.body;

        if (!url) {
            return res.status(400).json({ error: '请填写 Miniflux URL' });
        }

        if (authType === 'api_key') {
            if (!apiKey) {
                return res.status(400).json({ error: '请填写 API Key' });
            }
        } else {
            if (!username || !password) {
                return res.status(400).json({ error: '请填写用户名和密码' });
            }
        }

        // 测试连接
        try {
            const testClient = new MinifluxClient(url, username, password, apiKey);
            await testClient.request('/me');
        } catch (testError) {
            console.error('Miniflux connection test failed:', testError);
            return res.status(400).json({ error: '连接测试失败，请检查 URL 和登录信息是否正确' });
        }

        // 保存配置
        const success = MinifluxConfigStore.saveManualConfig(url, username, password, apiKey, authType);
        if (!success) {
            return res.status(500).json({ error: '保存配置失败' });
        }

        // 清除客户端缓存，使用新配置
        clearMinifluxClientCache();

        res.json({
            success: true,
            message: '配置保存成功',
            config: MinifluxConfigStore.getSafeConfig()
        });
    } catch (error) {
        console.error('Save miniflux config error:', error);
        res.status(500).json({ error: '保存配置失败' });
    }
});

// Test Miniflux connection (without saving)
router.post('/miniflux-test', authenticateToken, async (req, res) => {
    try {
        const { url, username, password, apiKey } = req.body;

        if (!url) {
            return res.status(400).json({ error: '请填写 Miniflux URL' });
        }

        try {
            const testClient = new MinifluxClient(url, username, password, apiKey);
            const me = await testClient.request('/me');
            res.json({
                success: true,
                message: '连接测试成功',
                user: me.username
            });
        } catch (testError) {
            console.error('Miniflux connection test failed:', testError);
            res.status(400).json({ error: '连接失败: ' + (testError.message || '请检查配置') });
        }
    } catch (error) {
        console.error('Test miniflux config error:', error);
        res.status(500).json({ error: '测试失败' });
    }
});

// Clear manual config
router.delete('/miniflux-config', authenticateToken, (req, res) => {
    try {
        // 不允许删除环境变量配置
        if (MinifluxConfigStore.isEnvConfigured()) {
            return res.status(400).json({ error: '环境变量配置无法通过界面删除' });
        }

        const success = MinifluxConfigStore.clearManualConfig();
        if (!success) {
            return res.status(500).json({ error: '清除配置失败' });
        }

        clearMinifluxClientCache();
        res.json({ success: true, message: '配置已清除' });
    } catch (error) {
        console.error('Clear miniflux config error:', error);
        res.status(500).json({ error: '清除配置失败' });
    }
});

// Legacy env-config endpoint (for backwards compatibility)
router.get('/env-config', (req, res) => {
    const safeConfig = MinifluxConfigStore.getSafeConfig();
    res.json(safeConfig);
});

export default router;

