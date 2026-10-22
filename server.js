require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { generalApiLimiter } = require('./src/middleware/rateLimiter');
const path = require('path');
const { initDatabase, cleanupReviewedSubmissions } = require('./src/db/database');
const { renderPageHtml } = require('./src/services/pageRenderer');

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
const groupRoutes = require('./src/routes/groups');
const dailyIdeaRoutes = require('./src/routes/dailyIdeas');

const app = express();
const PORT = process.env.PORT || 3000;

// 反向代理支持：默认不信任 X-Forwarded-For（否则客户端可伪造 IP 绕过限流）。
// 部署在 Nginx / 云负载均衡之后时，请设置 TRUST_PROXY=1（或具体跳数、可信网段）。
if (process.env.TRUST_PROXY) {
  const rawTrustProxy = String(process.env.TRUST_PROXY).trim();
  if (/^\d+$/.test(rawTrustProxy)) {
    app.set('trust proxy', Number.parseInt(rawTrustProxy, 10));
  } else if (rawTrustProxy === 'true' || rawTrustProxy === 'false') {
    app.set('trust proxy', rawTrustProxy === 'true');
  } else {
    app.set('trust proxy', rawTrustProxy);
  }
}

// 基础安全响应头（零依赖）
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// CORS：默认不开启（前后端同源部署无需 CORS）。如需跨域，用 CORS_ORIGINS 配置逗号分隔白名单。
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// 规范化重定向：将 /index.html 与其他 *.html 重定向至标准路由（确保经由服务端水合直出）
app.get('/:page.html', (req, res) => {
  const page = req.params.page;
  if (page === 'index') return res.redirect(301, '/');
  return res.redirect(301, `/${page}`);
});
app.get('/page/:slug.html', (req, res) => {
  return res.redirect(301, `/page/${req.params.slug}`);
});

// 静态资源托管
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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
app.use('/api/groups', groupRoutes);
app.use('/api/daily-ideas', dailyIdeaRoutes);

// 多独立网页路由（服务端直出预渲染与数据水合注入，消除内容跳变与FOUC）
app.get('/', async (req, res, next) => {
  try {
    const html = await renderPageHtml('index', 'home');
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    next(err);
  }
});

app.get('/about', async (req, res, next) => {
  try {
    const html = await renderPageHtml('about', 'about');
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
  } catch (err) {
    next(err);
  }
});

app.get('/recruitment', async (req, res, next) => {
  try {
    const html = await renderPageHtml('recruitment', 'recruitment');
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'recruitment.html'));
  } catch (err) {
    next(err);
  }
});

app.get('/notices', async (req, res, next) => {
  try {
    const html = await renderPageHtml('notices', 'notices');
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'notices.html'));
  } catch (err) {
    next(err);
  }
});

app.get('/contact', async (req, res, next) => {
  try {
    const html = await renderPageHtml('contact', 'contact');
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
  } catch (err) {
    next(err);
  }
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
    const html = await renderPageHtml('custom_page', req.params.slug);
    if (html) return res.send(html);
    res.sendFile(path.join(__dirname, 'public', 'custom_page.html'));
  } catch (error) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// 404 兜底处理（HTML页面展示友好的404.html，API请求返回JSON）
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.status(404).json({
    success: false,
    message: '请求的页面或接口资源不存在'
  });
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
    // 启动前置校验：缺少 JWT_SECRET 时直接拒绝启动，避免以弱密钥/空密钥运行
    if (!process.env.JWT_SECRET) {
      console.error('[Startup] ❌ 未配置 JWT_SECRET，服务拒绝启动。请在 .env 中设置至少 32 位随机字符串。');
      process.exit(1);
    }
    if (String(process.env.JWT_SECRET).length < 32) {
      console.warn('[Startup] ⚠️ JWT_SECRET 长度不足 32 位，建议立即更换为更强的随机密钥。');
    }

    await initDatabase();

    // 附件清理：启动 10 分钟后再执行首次清理，避免"服务重启即删除历史附件"的误删风险；
    // 保留天数由 ATTACHMENT_RETENTION_DAYS 控制（默认 30 天，<=0 关闭）。
    const runAttachmentCleanup = () => {
      cleanupReviewedSubmissions().catch(error => console.error('[Cleanup] 定时清理失败:', error));
    };
    setTimeout(runAttachmentCleanup, 10 * 60 * 1000).unref();
    setInterval(runAttachmentCleanup, 6 * 60 * 60 * 1000).unref();

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
      console.log(`🔑 初始超级管理员: superadmin@campus.club（初始密码仅在首次创建时打印，或由 ADMIN_INITIAL_PASSWORD 指定）`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();