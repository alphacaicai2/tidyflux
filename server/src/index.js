import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feeds.js';
import articleRoutes from './routes/articles.js';
import groupRoutes from './routes/groups.js';
import preferenceRoutes from './routes/preferences.js';
import faviconRoutes from './routes/favicon.js';
import digestRoutes from './routes/digest.js';
import aiRoutes from './routes/ai.js';
import { UserStore } from './utils/user-store.js';
import { DigestScheduler } from './jobs/digest-scheduler.js';

// Initialize User Store (creates default admin if needed)
UserStore.init();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/feeds', feedRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/favicon', faviconRoutes);
app.use('/api/digest', digestRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: 'miniflux-adapter' });
});

// Serve static files from www directory
const wwwPath = join(__dirname, '..', '..', 'www');

// Service Worker 必须禁用缓存，确保浏览器每次都检查更新
app.get('/sw.js', (req, res) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(join(wwwPath, 'sw.js'));
});

app.use(express.static(wwwPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(join(wwwPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Tidyflux Adapter running on http://localhost:${PORT}`);
    // 启动简报调度器
    DigestScheduler.start();
});
