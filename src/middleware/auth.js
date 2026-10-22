const jwt = require('jsonwebtoken');
const { getOne } = require('../db/database');

// 密钥必须由环境变量提供，代码中不再保留任何可用的默认密钥。
// 缺失时保留 undefined：签发/校验会直接抛错（失败即关闭），而不是静默使用弱密钥。
const JWT_SECRET = process.env.JWT_SECRET || null;

if (!JWT_SECRET) {
  console.error('[Auth] ❌ 未配置 JWT_SECRET 环境变量，所有登录签发与鉴权都将失败，请在 .env 中设置至少 32 位随机字符串。');
} else if (JWT_SECRET.length < 32) {
  console.warn('[Auth] ⚠️ JWT_SECRET 长度不足 32 位，建议更换为更长的随机密钥。');
}

// 统一的 Cookie 配置：仅当显式开启 COOKIE_SECURE 时才加 Secure，
// 避免纯 HTTP 部署（如 http://IP:5624）下开启后浏览器不再回传 Cookie 导致登录失效。
function buildCookieOptions() {
  const options = {
    httpOnly: true,
    maxAge: 7 * 24 * 3600 * 1000,
    sameSite: 'lax',
    path: '/'
  };
  if (process.env.COOKIE_SECURE === 'true') options.secure = true;
  return options;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 身份认证解析中间件 (异步处理)
async function authenticateToken(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: '请先登录后访问该资源' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 从数据库异步获取最新用户信息与最新角色
    const user = await getOne('SELECT id, name, email, college, className, qq, role, created_at FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在或已被注销' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: '登录状态失效或凭据无效，请重新登录' });
  }
}

// 可选认证（未登录也允许访问，但如果携带Token则解析用户）
async function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        const user = await getOne('SELECT id, name, email, college, className, qq, role, created_at FROM users WHERE id = ?', [decoded.id]);
        if (user) req.user = user;
      }
    } catch (e) {
      // 忽略无效token，继续以访客身份处理
    }
  }
  next();
}

// 角色鉴权中间件
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }

    // super_admin 默认拥有 admin 和 member 的所有权限
    const roleHierarchy = {
      'super_admin': ['super_admin', 'admin', 'member', 'user'],
      'admin': ['admin', 'member', 'user'],
      'member': ['member', 'user'],
      'user': ['user']
    };

    const userGranted = roleHierarchy[req.user.role] || [];
    const hasPermission = allowedRoles.some(role => userGranted.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法执行该操作（需要权限：' + allowedRoles.join(' 或 ') + '）'
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  buildCookieOptions,
  generateToken,
  authenticateToken,
  optionalAuth,
  requireRole
};
