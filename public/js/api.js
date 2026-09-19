/* =========================================================
   API 请求中心与通用客户端工具函数 (API Client & Utilities)
   ========================================================= */

const API_BASE = '/api';

// 获取存储的 Token
function getToken() {
  return localStorage.getItem('campus_token');
}

// 获取当前登录用户对象（严格要求 token 和 user 同时存在）
function getCurrentUser() {
  const token = getToken();
  const userStr = localStorage.getItem('campus_user');
  if (!token || !userStr) {
    if (!token && userStr) {
      try { localStorage.removeItem('campus_user'); } catch (e) {}
    }
    return null;
  }
  try {
    return JSON.parse(userStr);
  } catch (e) {
    try { localStorage.removeItem('campus_user'); } catch (err) {}
    return null;
  }
}

// 设定登录态
function setCurrentUser(user, token) {
  if (token) localStorage.setItem('campus_token', token);
  if (user) localStorage.setItem('campus_user', JSON.stringify(user));
}

// 退出登录
function logout() {
  localStorage.removeItem('campus_token');
  localStorage.removeItem('campus_user');
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showToast('已安全退出登录', 'info');
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}

// 安全 HTML 转义，杜绝 XSS 漏洞（所有页面通用，admin 后台也依赖此函数）
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
}

// 实时从服务端同步最新用户信息与角色，彻底杜绝权限变更后的缓存不同步问题
async function syncCurrentUser() {
  const token = getToken();
  if (!token) {
    try { localStorage.removeItem('campus_user'); } catch (e) {}
    return null;
  }
  try {
    const res = await apiRequest('/auth/me');
    if (res && res.success && res.user) {
      setCurrentUser(res.user, token);
      return res.user;
    }
  } catch (e) {
    if (e.status === 401 || e.status === 403 || (e.message && (e.message.includes('401') || e.message.includes('403') || e.message.includes('失效') || e.message.includes('登录') || e.message.includes('Token') || e.message.includes('Unauthorized')))) {
      try {
        localStorage.removeItem('campus_token');
        localStorage.removeItem('campus_user');
      } catch (err) {}
      return null;
    }
  }
  return getCurrentUser();
}

// 统一 API 网络请求
async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = getToken();
  const requestBody = options.body && typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof URLSearchParams)
    ? JSON.stringify(options.body)
    : options.body;

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 若不是 FormData，则默认使用 JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      body: requestBody,
      headers
    });

    // 针对 401 / 403 拦截
    if (response.status === 401 || response.status === 403) {
      // 若处于需要认证的后台或个人中心页面，跳转回主页
      if (typeof window !== 'undefined' && window.location && (window.location.pathname.includes('/admin') || window.location.pathname.includes('/profile'))) {
        localStorage.removeItem('campus_token');
        localStorage.removeItem('campus_user');
        window.location.href = '/?login=1';
        return;
      }
    }

    let data = {};
    try {
      data = await response.json();
    } catch (parseErr) {
      data = { success: false, message: `请求失败 (${response.status})` };
    }
    if (!response.ok) {
      const err = new Error(data.message || `请求失败 (${response.status})`);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (error) {
    // 给 JSON 解析错误提供更友好的提示
    const msg = error instanceof SyntaxError ? '服务器返回数据格式异常，请确认服务已重启' : error.message;
    console.error(`API Error [${endpoint}]:`, msg);
    throw new Error(msg);
  }
}

// Toast 消息提示组件
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span style="font-size: 16px;">${iconMap[type] || '🔔'}</span>
    <div style="flex-grow: 1;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// =========================================================
// 🪟 模态弹窗智能控制器 (Modal Controller & Ghost-Click Shield)
// 彻底解决移动端触控穿透、合成点击误关、连续点击失效问题
// =========================================================

let lastModalOpenedTime = 0;
let modalPointerDownTarget = null;

// 记录按下时的原始目标，杜绝移动端 tap-through / ghost-click 穿透关闭背景
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    modalPointerDownTarget = e.target;
  }, true);

  document.addEventListener('touchstart', (e) => {
    modalPointerDownTarget = e.target;
  }, { passive: true, capture: true });

  document.addEventListener('mousedown', (e) => {
    modalPointerDownTarget = e.target;
  }, true);

  // 严格限定仅当在 modal-overlay 背景本身按下并抬起、且距离打开超过 320ms 时才关闭
  document.addEventListener('click', (e) => {
    if (Date.now() - lastModalOpenedTime < 320) {
      return; // 屏蔽移动端刚展开弹窗瞬间产生的合成点击
    }
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
      if (modalPointerDownTarget === e.target) {
        closeModal(e.target);
      }
    }
  });

  // ESC 键快捷退出
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const activeModals = document.querySelectorAll('.modal-overlay.active');
      activeModals.forEach(m => closeModal(m));
    }
  });
}

function openModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    lastModalOpenedTime = Date.now();
    modalPointerDownTarget = null;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (document.body) {
      document.body.style.overflow = 'hidden';
    }

    // 智能聚焦弹窗内首个可用输入框
    const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea, button.btn-primary');
    if (firstInput && typeof firstInput.focus === 'function') {
      setTimeout(() => {
        try { firstInput.focus(); } catch (e) {}
      }, 120);
    }
  }
}

function closeModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const remainingActive = document.querySelectorAll('.modal-overlay.active');
    if (remainingActive.length === 0 && document.body) {
      document.body.style.overflow = '';
    }
  }
}

if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
}

// 格式化角色显示
function getRoleBadge(role) {
  switch (role) {
    case 'super_admin':
      return `<span class="badge badge-super">👑 超级管理员</span>`;
    case 'admin':
      return `<span class="badge badge-admin">🛡️ 管理员</span>`;
    case 'member':
      return `<span class="badge badge-member">🌟 社团成员</span>`;
    case 'user':
    default:
      return `<span class="badge badge-user">👤 普通用户</span>`;
  }
}

function getRoleName(role) {
  switch (role) {
    case 'super_admin': return '超级管理员';
    case 'admin': return '管理员';
    case 'member': return '社团成员';
    case 'user': return '普通用户';
    default: return '未知';
  }
}

// 格式化申请状态显示
function getStatusBadge(status) {
  switch (status) {
    case 'pending':
      return `<span class="badge badge-status-pending">⏳ 待审核</span>`;
    case 'approved':
      return `<span class="badge badge-status-approved">✅ 审核通过</span>`;
    case 'rejected':
      return `<span class="badge badge-status-rejected">❌ 已驳回</span>`;
    default:
      return `<span class="badge badge-user">${status}</span>`;
  }
}

// 格式化日期时间
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// =========================================================
// 📱 全网页智能自动适配引擎 (Universal Auto Responsive Engine)
// 动态计算视口像素级宽高、触控状态，自适应注入响应式滚动容器
// =========================================================
function initAutoResponsiveEngine() {
  if (typeof window === 'undefined' || window.__autoResponsiveEngineInitialized) return;
  window.__autoResponsiveEngineInitialized = true;

  function applyResponsiveState() {
    const width = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0) || 375;
    const height = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0) || 667;
    const root = document.documentElement;
    if (!root) return;

    // 1. 动态设定真实视口尺寸变量，解决移动端 100vh 各种浏览器地址栏遮挡及拉伸 Bug
    root.style.setProperty('--vw', `${width}px`);
    root.style.setProperty('--vh', `${height * 0.01}px`);

    // 2. 移除旧断点标记并赋予当前断点类
    root.classList.remove('size-xs', 'size-sm', 'size-md', 'size-lg', 'size-xl');
    if (width < 480) {
      root.classList.add('size-xs'); // 紧凑型小屏手机 (320px - 479px)
    } else if (width < 768) {
      root.classList.add('size-sm'); // 大屏手机 / 横屏手机 (480px - 767px)
    } else if (width < 1024) {
      root.classList.add('size-md'); // 平板电脑 / iPad (768px - 1023px)
    } else if (width < 1440) {
      root.classList.add('size-lg'); // 普通笔记本 / 桌面端 (1024px - 1439px)
    } else {
      root.classList.add('size-xl'); // 宽屏大显示器 / 2K / 4K (>= 1440px)
    }

    // 3. 设备触控感知
    const isTouch = (typeof window !== 'undefined' && 'ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    root.classList.toggle('is-touch-device', isTouch);
    root.classList.toggle('is-pointer-device', !isTouch);

    // 4. 视口变宽时自动收起移动端侧栏与抽屉
    if (width > 900) {
      if (typeof closeMobileDrawer === 'function') {
        closeMobileDrawer();
      }
      if (typeof closeMobileSidebar === 'function') {
        closeMobileSidebar();
      }
    }
  }

  // 5. 自动为网页内所有未经包装的 table 注入自适应横向滑槽，杜绝动态内容撑爆页面
  function autoWrapTables() {
    if (!document.body) return;
    document.querySelectorAll('table').forEach(table => {
      const parent = table.parentElement;
      if (!parent) return;
      if (!parent.classList.contains('table-responsive') && !parent.classList.contains('data-table-wrap')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        parent.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyResponsiveState();
      autoWrapTables();
    });
  } else {
    applyResponsiveState();
    autoWrapTables();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(applyResponsiveState);
  }, { passive: true });

  window.addEventListener('orientationchange', () => {
    setTimeout(applyResponsiveState, 120);
  });

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      autoWrapTables();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
}

initAutoResponsiveEngine();
window.initAutoResponsiveEngine = initAutoResponsiveEngine;

// 统一全局挂载工具函数，杜绝不同页面作用域缺失与严格模式报错
if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showToast = showToast;
  window.apiRequest = apiRequest;
  window.getToken = getToken;
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.logout = logout;
  window.syncCurrentUser = syncCurrentUser;
  window.escapeHtml = escapeHtml;
  window.getRoleBadge = getRoleBadge;
  window.getRoleName = getRoleName;
  window.getStatusBadge = getStatusBadge;
  window.formatDateTime = formatDateTime;
  window.formatFileSize = formatFileSize;
  window.initAutoResponsiveEngine = initAutoResponsiveEngine;
}
