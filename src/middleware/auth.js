const jwt = require('jsonwebtoken');
const { getOne } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_club_jwt_secret_key_2026';

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
  generateToken,
  authenticateToken,
  optionalAuth,
  requireRole
};
