require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { generalApiLimiter } = require('./src/middleware/rateLimiter');
const path = require('path');
const { initDatabase, cleanupReviewedSubmissions } = require('./src/db/database');

const authRoutes = require('./src/routes/auth');
const portalRoutes = require('./src/routes/portal');
const applicationRoutes = require('./src/routes/applications');
const noticeRoutes = require('./src/routes/notices');
const userRoutes = require('./src/routes/users');
const mailRoutes = require('./src/routes/mail');
const pageRoutes = require('./src/routes/pages');
const messageRoutes = require('./src/routes/messages');
const proposalRoutes = require('./src/routes/proposals');
const directionsRoutes = require('./src/routes/directions');
const categoriesRoutes = require('./src/routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态资源托管
app.use(express.static(path.join(__dirname, 'public')));

// 全局 API 接口防刷限流中间件 (单 IP 窗口限制)
app.use('/api', generalApiLimiter);

// API 路由注册
app.use('/api/auth', authRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/directions', directionsRoutes);
app.use('/api/categories', categoriesRoutes);

// 多独立网页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/recruitment', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recruitment.html'));
});

app.get('/notices', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'notices.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// 自定义新增网页通用路由
app.get('/page/:slug', async (req, res) => {
  try {
    const { getOne } = require('./src/db/database');
    const page = await getOne('SELECT id FROM site_pages WHERE slug = ?', [req.params.slug]);
    if (!page) {
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'custom_page.html'));
  } catch (error) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部运行异常'
  });
});

async function startServer() {
  try {
    await initDatabase();
    await cleanupReviewedSubmissions();
    setInterval(() => {
      cleanupReviewedSubmissions().catch(error => console.error('[Cleanup] 定时清理失败:', error));
    }, 6 * 60 * 60 * 1000);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`🚀 高校社团官网与管理系统正在运行于: http://localhost:${PORT}`);
      console.log(`🌐 官网门户主页: http://localhost:${PORT}`);
      console.log(`📖 关于社团页面: http://localhost:${PORT}/about`);
      console.log(`🚀 纳新通道页面: http://localhost:${PORT}/recruitment`);
      console.log(`📢 通知公告页面: http://localhost:${PORT}/notices`);
      console.log(`📞 联系方式页面: http://localhost:${PORT}/contact`);
      console.log(`🛡️ 综合管理后台: http://localhost:${PORT}/admin`);
      console.log(`👤 个人中心专区: http://localhost:${PORT}/profile`);
      console.log(`🔑 初始超级管理员账号: superadmin@campus.club  密码: Admin@123456`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();