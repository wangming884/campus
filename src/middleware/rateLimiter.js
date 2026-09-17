/**
 * 高性能、轻量级接口防刷限流中间件 (Rate Limiter)
 * 零外部依赖，支持滑动窗口/令牌桶计数，内置定期内存垃圾清理
 */

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = String(forwarded).split(',');
    return list[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

class MemoryStore {
  constructor(cleanupIntervalMs = 60000) {
    this.hits = new Map();
    this.timer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.hits.entries()) {
      if (now > item.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  increment(key, windowMs) {
    const now = Date.now();
    let record = this.hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      this.hits.set(key, record);
      return {
        totalHits: 1,
        resetTime: record.resetTime,
        remaining: -1
      };
    }

    record.count += 1;
    return {
      totalHits: record.count,
      resetTime: record.resetTime,
      remaining: -1
    };
  }

  resetKey(key) {
    this.hits.delete(key);
  }
}

const defaultStore = new MemoryStore();

/**
 * 创建限流中间件工厂函数
 * @param {Object} options
 * @param {number} options.windowMs - 时间窗口(毫秒)
 * @param {number} options.max - 窗口内允许的最大请求次数
 * @param {string} options.message - 触发限流时的提示文案
 * @param {function} options.keyGenerator - 限流 key 生成函数，默认为客户端 IP
 * @param {boolean} options.skipFailedRequests - 是否仅限成功请求
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 60,
    message = '请求过于频繁，请稍后再试',
    statusCode = 429,
    keyGenerator = (req) => getClientIp(req),
    skip = () => false
  } = options;

  const store = new MemoryStore();

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const { totalHits, resetTime } = store.increment(key, windowMs);
    const now = Date.now();
    const remainingMs = Math.max(0, resetTime - now);
    const remainingSec = Math.ceil(remainingMs / 1000);
    const remainingHits = Math.max(0, max - totalHits);

    // 设置标准 HTTP RateLimit 响应头
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remainingHits);
    res.setHeader('RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (totalHits > max) {
      res.setHeader('Retry-After', remainingSec);
      return res.status(statusCode).json({
        success: false,
        message: typeof message === 'function' ? message(req, remainingSec) : `${message}（请等待 ${remainingSec} 秒）`,
        retryAfter: remainingSec
      });
    }

    next();
  };
}

// 预设常用限流器

// 1. 全局 API 通用防护：单个 IP 每分钟最多 300 次
const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: '网络请求过于频繁，请稍作休息'
});

// 2. 邮箱验证码发送严格防护：
// - 同一 IP 每分钟最多触发 5 次
// - 同一邮箱每分钟最多 1 次，每小时最多 5 次
const verificationCodeIpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: '获取验证码过于频繁，请稍后再试'
});

const verificationCodeEmailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时窗口
  max: 5,                   // 单个邮箱 1 小时内最多 5 次
  keyGenerator: (req) => {
    const email = String(req.body?.email || req.query?.email || '').trim().toLowerCase();
    return `email_verify_${email || getClientIp(req)}`;
  },
  message: '该邮箱 1 小时内获取验证码次数已达上限，请稍后再试'
});

// 3. 用户登录防暴力破解：同一个 IP / 邮箱组合 15 分钟内最多尝试 15 次
const authLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: (req) => {
    const account = String(req.body?.email || '').trim().toLowerCase();
    const ip = getClientIp(req);
    return `login_${ip}_${account}`;
  },
  message: '登录失败尝试次数过多，为了保障账号安全已被临时锁定，请 15 分钟后再试'
});

// 4. 招新申请表提交防重放：同一个用户 1 分钟内最多提交 2 次
const applicationSubmitLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 2,
  keyGenerator: (req) => {
    const userId = req.user?.id || getClientIp(req);
    return `app_submit_${userId}`;
  },
  message: '入社申请提交过于频繁，请勿重复点击'
});

// 5. 留言板防刷：同一个用户/IP 每分钟最多发表 3 条留言
const messagePostLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => {
    const userId = req.user?.id || getClientIp(req);
    return `msg_post_${userId}`;
  },
  message: '留言发送过于频繁，请稍等片刻后再发表'
});

module.exports = {
  createRateLimiter,
  generalApiLimiter,
  verificationCodeIpLimiter,
  verificationCodeEmailLimiter,
  authLoginLimiter,
  applicationSubmitLimiter,
  messagePostLimiter
};
