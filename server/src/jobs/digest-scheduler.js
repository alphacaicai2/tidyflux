import { getMinifluxClient } from '../middleware/auth.js';
import { PreferenceStore } from '../utils/preference-store.js';
import { DigestService } from '../services/digest-service.js';

function getCurrentTimeStr() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}



export const DigestScheduler = {
    start() {
        console.log('Starting Digest Scheduler...');
        // 每分钟检查一次 (60000ms)
        // 使用 setTimeout 递归调用以避免任务执行时间过长导致堆叠，虽然这里生成过程是异步的
        const run = async () => {
            await this.runCheck();
            // 计算下一分钟的整点延迟，或者简单地一分钟后
            setTimeout(run, 60000);
        };

        // 第一次延迟启动，例如 10秒后
        setTimeout(run, 10000);
    },

    async runCheck() {
        const currentTime = getCurrentTimeStr();


        // 获取所有用户
        const userIds = PreferenceStore.getAllUserIds();

        for (const userId of userIds) {
            try {
                const prefs = PreferenceStore.get(userId);

                // 兼容旧的单一 schedule 配置：如果是对象则转换为数组
                let schedules = [];
                if (Array.isArray(prefs.digest_schedules)) {
                    schedules = prefs.digest_schedules;
                } else if (prefs.digest_schedule && typeof prefs.digest_schedule === 'object') {
                    // 迁移旧配置
                    schedules = [{
                        id: 'default',
                        ...prefs.digest_schedule
                    }];
                    // 清理旧配置，迁移到新字段
                    prefs.digest_schedules = schedules;
                    delete prefs.digest_schedule;
                    PreferenceStore.save(userId, prefs);
                }

                if (schedules.length === 0) continue;

                // let prefsModified = false; // Removed synchronous flag

                // 遍历所有定时任务
                for (const task of schedules) {
                    // 检查启用状态
                    if (!task.enabled) continue;

                    // 检查时间匹配
                    if (task.time !== currentTime) continue;



                    console.log(`Triggering scheduled digest for user ${userId} [Scope: ${task.scope}] at ${currentTime}`);

                    // 准备参数
                    const aiConfig = prefs.ai_config;
                    if (!aiConfig || !aiConfig.apiKey) {
                        console.error(`Skipping digest for ${userId}: AI not configured.`);
                        continue;
                    }

                    const minifluxClient = getMinifluxClient();
                    if (!minifluxClient) {
                        console.error(`Skipping digest for ${userId}: Miniflux client not available.`);
                        continue;
                    }

                    // 确定目标语言
                    const targetLang = prefs.ai_config?.targetLang ||
                        prefs.ai_config?.summarizeLang ||
                        'zh-CN';

                    // 调用生成服务 - 异步执行，不阻塞调度器
                    // 使用全局配置的自定义 Prompt，保持一致性
                    const digestOptions = {
                        scope: task.scope || 'all',
                        hours: task.hours || 24,
                        targetLang: targetLang,
                        aiConfig: aiConfig,
                        prompt: aiConfig.digestPrompt
                    };

                    if (task.scope === 'feed') {
                        digestOptions.feedId = task.feedId || task.scopeId;
                    } else if (task.scope === 'group') {
                        digestOptions.groupId = task.groupId || task.scopeId;
                    }

                    DigestService.generate(minifluxClient, userId, digestOptions).then(result => {
                        if (result.success) {
                            console.log(`Digest generated for user ${userId} [Task: ${task.scope}]:`, result.digest.id);



                        } else {
                            console.error(`Digest generation failed for user ${userId} [Task: ${task.scope}]:`, result);
                        }
                    }).catch(err => {
                        console.error(`Error in digest generation for user ${userId}:`, err);
                    });
                }

                // prefsModified check removed as it is now handled asynchronously

            } catch (error) {
                console.error(`Error in digest scheduler for user ${userId}:`, error);
            }
        }
    }
};
