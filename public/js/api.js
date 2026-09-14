/* =========================================================
   API 请求中心与通用客户端工具函数 (API Client & Utilities)
   ========================================================= */

const API_BASE = '/api';

// 获取存储的 Token
function getToken() {
  return localStorage.getItem('campus_token');
}

// 获取当前登录用户对象
function getCurrentUser() {
  const userStr = localStorage.getItem('campus_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
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
  if (!token) return null;
  try {
    const res = await apiRequest('/auth/me');
    if (res && res.success && res.user) {
      setCurrentUser(res.user);
      return res.user;
    }
  } catch (e) {
    if (e.message && (e.message.includes('401') || e.message.includes('失效') || e.message.includes('登录'))) {
      localStorage.removeItem('campus_token');
      localStorage.removeItem('campus_user');
    }
  }
  return getCurrentUser();
}

// 统一 API 网络请求
async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = getToken();

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
      headers
    });

    // 针对 401 拦截
    if (response.status === 401) {
      // 若处于需要认证的后台或个人中心页面，跳转回主页
      if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/profile')) {
        localStorage.removeItem('campus_token');
        localStorage.removeItem('campus_user');
        window.location.href = '/';
        return;
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `请求失败 (${response.status})`);
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

// 模态弹窗控制
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// 点击模态背景关闭
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

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