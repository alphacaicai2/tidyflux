import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { PreferenceStore } from '../utils/preference-store.js';

const router = express.Router();

// Get all preferences
router.get('/', authenticateToken, (req, res) => {
    try {
        const userId = PreferenceStore.getUserId(req.user);
        console.log('Loading preferences for user:', userId);
        const prefs = PreferenceStore.get(userId);

        // Mask AI API Key
        if (prefs && prefs.ai_config && prefs.ai_config.apiKey) {
            prefs.ai_config.apiKey = '********';
        }

        res.json(prefs);
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: '获取偏好设置失败' });
    }
});

// Update preferences (merge with existing)
router.post('/', authenticateToken, (req, res) => {
    try {
        const userId = PreferenceStore.getUserId(req.user);
        console.log('Saving preferences for user:', userId, 'body:', req.body);
        const currentPrefs = PreferenceStore.get(userId);

        let updates = req.body;

        // 处理 { key, value } 格式的请求
        if (updates.key !== undefined && updates.value !== undefined) {
            const key = updates.key;
            const value = updates.value;
            updates = { [key]: value };
        }

        // Special handling for ai_config updates to preserve API Key if masked
        if (updates.ai_config) {
            // If the new key is masked, restore the old key
            if (updates.ai_config.apiKey === '********') {
                if (currentPrefs.ai_config && currentPrefs.ai_config.apiKey) {
                    updates.ai_config.apiKey = currentPrefs.ai_config.apiKey;
                } else {
                    // If no old key exists, remove the masked value to avoid saving garbage
                    delete updates.ai_config.apiKey;
                }
            }
        }

        // 合并更新
        const newPrefs = { ...currentPrefs, ...updates };
        console.log('New preferences:', newPrefs);

        if (PreferenceStore.save(userId, newPrefs)) {
            // Return masked key in response
            const responsePrefs = JSON.parse(JSON.stringify(newPrefs));
            if (responsePrefs.ai_config && responsePrefs.ai_config.apiKey) {
                responsePrefs.ai_config.apiKey = '********';
            }
            res.json({ success: true, preferences: responsePrefs });
        } else {
            res.status(500).json({ error: '保存偏好设置失败' });
        }
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: '更新偏好设置失败' });
    }
});

export default router;

