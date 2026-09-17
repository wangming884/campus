/* =========================================================
   管理后台控制中心业务逻辑 (Admin Dashboard Logic)
   ========================================================= */

// 安全 HTML 转义函数（杜绝 XSS 注入，保障管理后台表格渲染与动态文本安全）
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

let currentUser = null;
let currentTab = 'portal';
let cachedApplications = [];
let cachedTemplates = [];
let cachedNotices = [];
let cachedUsers = [];
let cachedMailLogs = [];
let cachedPages = [];
let cachedAdminProposals = [];
let cachedAdminMessages = [];
let currentReviewAppId = null;
let currentDecisionProposalId = null;
let currentReplyMessageId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 实时从服务端拉取最新身份，杜绝被提拔为管理员后因旧缓存误踢的 Bug
  if (typeof syncCurrentUser === 'function') {
    await syncCurrentUser();
  }
  if (!checkAdminAuth()) return;
  initAdminProfile();
  switchAdminTab('portal');
  // 预检待审核申请数
  checkPendingCount();
});

// 1. 权限守卫与身份校验
function checkAdminAuth() {
  currentUser = getCurrentUser();
  if (!currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
    showToast('无权访问后台系统，需要管理员或超级管理员权限', 'error');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
    return false;
  }
  return true;
}

function initAdminProfile() {
  document.getElementById('admin-user-name').innerText = currentUser.name;
  document.getElementById('admin-avatar').innerText = currentUser.name.slice(0, 1);
  document.getElementById('admin-user-badge').innerHTML = getRoleBadge(currentUser.role);

  // 若不是超级管理员，隐藏或提示邮件配置卡片
  const mailCard = document.getElementById('card-mail-settings');
  if (mailCard && currentUser.role !== 'super_admin') {
    mailCard.innerHTML = `
      <div class="card-body">
        <div class="alert alert-warning" style="margin: 0;">
          🔒 <strong>权限限制：</strong>邮件服务器 (SMTP) 参数配置为<strong>【超级管理员】独享权限</strong>。当前您为管理员，可于下方查看系统已生成的发信日志与通知历史。
        </div>
      </div>
    `;
  }
}

// 2. 标签页切换
function switchAdminTab(tabName) {
  currentTab = tabName;

  // 更新侧边栏导航样式
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
  const activeNavItem = document.getElementById(`nav-tab-${tabName}`);
  if (activeNavItem) activeNavItem.classList.add('active');

  // 更新内容区域
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const activePane = document.getElementById(`pane-${tabName}`);
  if (activePane) activePane.classList.add('active');

  // 更新顶部标题
  const titleMap = {
    portal: '🎨 官网主页动态配置 (CMS)',
    pages: '🌐 网站所有页面综合管理 (CMS)',
    audit: '📋 入社申请表审核与成员录取',
    templates: '📁 招新申请表模板维护与更换',
    notices: '📢 社团通知与公告发布管理',
    proposals: '🎯 社团活动提案审核与举办决议中心',
    messages: '💬 成员交流留言与官方答复中心',
    users: '👥 全体成员目录与 RBAC 权限调度',
    mail: '📧 邮件服务配置与发信日志模拟器',
    directions: '🎯 发展意向方向选项管理',
    categories: '🏷️ 活动类别选项管理',
    'role-applications': '🔄 社团成员晋升管理员申请审核'
  };
  document.getElementById('topbar-page-title').innerHTML = `<span>${titleMap[tabName] || '管理后台'}</span>`;

  // 加载该标签对应数据
  switch (tabName) {
    case 'portal': loadPortalCMS(); break;
    case 'pages': loadPagesAdmin(); break;
    case 'audit': loadApplications(); break;
    case 'templates': loadTemplates(); break;
    case 'notices': loadNoticesAdmin(); break;
    case 'proposals': loadProposalsAdmin(); break;
    case 'messages': loadMessagesAdmin(); break;
    case 'users': loadUsers(); break;
    case 'mail': loadMailSettingsAndLogs(); break;
    case 'directions': loadDirectionsAdmin(); break;
    case 'categories': loadCategoriesAdmin(); break;
    case 'role-applications': loadRoleApplicationsAdmin(); break;
  }
}

function refreshCurrentTab() {
  switchAdminTab(currentTab);
  checkPendingCount();
  showToast('数据已刷新', 'info', 1500);
}

// 检查待审核数量
async function checkPendingCount() {
  try {
    const res = await apiRequest('/applications?status=pending');
    if (res.success && Array.isArray(res.data)) {
      const count = res.data.length;
      const badge = document.getElementById('badge-pending-count');
      if (badge) {
        if (count > 0) {
          badge.innerText = count;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (e) {}
}

// ==================== 1. 官网主页配置 (Portal CMS) ====================
let currentCMSData = null;

async function loadPortalCMS() {
  try {
    const res = await apiRequest('/portal/config');
    if (res.success && res.data) {
      currentCMSData = res.data;
      const cfg = res.data;

      document.getElementById('cfg-club-name').value = cfg.club_name || '';
      document.getElementById('cfg-hero-badge').value = cfg.hero_badge || '';
      document.getElementById('cfg-hero-title').value = cfg.hero_title || '';
      document.getElementById('cfg-hero-subtitle').value = cfg.hero_subtitle || '';
      document.getElementById('cfg-about-title').value = cfg.about_title || '';
      document.getElementById('cfg-about-content').value = cfg.about_content || '';

      // 联系信息
      const contact = cfg.contact || {};
      document.getElementById('cfg-contact-email').value = contact.email || '';
      document.getElementById('cfg-contact-qqGroup').value = contact.qqGroup || '';
      document.getElementById('cfg-contact-wechat').value = contact.wechat || '';
      document.getElementById('cfg-contact-location').value = contact.location || '';

      // 渲染统计项输入框
      renderStatsInputs(cfg.stats || []);
      loadAboutDocumentInfo();
    }
  } catch (error) {
    showToast('获取官网配置失败: ' + error.message, 'error');
  }
}

async function loadAboutDocumentInfo() {
  const current = document.getElementById('about-document-current');
  if (!current) return;
  try {
    const res = await apiRequest('/portal/about-document/info');
    if (res.success && res.data) {
      current.innerHTML = `当前资料：<strong>${escapeHtml(res.data.title || res.data.filename)}</strong>（${formatFileSize(res.data.size)}，更新于 ${formatDateTime(res.data.updated_at)}）`;
    } else {
      current.innerText = '当前尚未上传社团介绍资料';
    }
  } catch (error) {
    current.innerText = '读取当前资料失败';
  }
}

async function handleAboutDocumentUpload(event) {
  event.preventDefault();
  const fileInput = document.getElementById('about-document-file');
  if (!fileInput.files || !fileInput.files[0]) return;

  const button = document.getElementById('btn-upload-about-document');
  const formData = new FormData();
  formData.append('title', document.getElementById('about-document-title').value.trim());
  formData.append('file', fileInput.files[0]);
  button.disabled = true;
  try {
    const res = await apiRequest('/portal/about-document', { method: 'POST', body: formData });
    showToast(res.message, 'success');
    document.getElementById('form-about-document').reset();
    loadAboutDocumentInfo();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function deleteAboutDocument() {
  if (!confirm('确定删除当前社团介绍资料吗？关于我们页面将隐藏下载入口。')) return;
  try {
    const res = await apiRequest('/portal/about-document', { method: 'DELETE' });
    showToast(res.message, 'success');
    loadAboutDocumentInfo();
  } catch (error) {
    showToast(`SMTP 配置失败：${error.message || '服务器未返回具体原因'}`, 'error', 6000);
  }
}

function renderStatsInputs(stats) {
  const container = document.getElementById('cfg-stats-inputs-container');
  if (!container) return;

  // 保证至少4项
  while (stats.length < 4) {
    stats.push({ label: '新指标', value: '100', unit: '+', icon: 'star' });
  }

  container.innerHTML = stats.slice(0, 4).map((s, index) => `
    <div style="background: #f8fafc; border: 1px solid var(--border); padding: 14px; border-radius: var(--radius-md);">
      <div style="font-weight: 700; margin-bottom: 8px; font-size: 13.5px; color: var(--primary);">指标卡片 #${index + 1}</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label class="form-label" style="font-size: 12px;">指标标题</label>
          <input type="text" class="form-control stat-in-label" value="${escapeHtml(s.label || '')}" required>
        </div>
        <div>
          <label class="form-label" style="font-size: 12px;">数值与单位</label>
          <div style="display: flex; gap: 6px;">
            <input type="text" class="form-control stat-in-value" value="${escapeHtml(s.value || '')}" placeholder="数字" required>
            <input type="text" class="form-control stat-in-unit" value="${escapeHtml(s.unit || '')}" placeholder="单位" style="width: 70px;">
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function savePortalConfig() {
  // 组装统计
  const statCards = document.querySelectorAll('#cfg-stats-inputs-container > div');
  const stats = [];
  statCards.forEach((card, idx) => {
    const label = card.querySelector('.stat-in-label').value;
    const value = card.querySelector('.stat-in-value').value;
    const unit = card.querySelector('.stat-in-unit').value;
    stats.push({
      label, value, unit,
      icon: ['users', 'calendar', 'award', 'layers'][idx] || 'star'
    });
  });

  const payload = {
    club_name: document.getElementById('cfg-club-name').value,
    hero_badge: document.getElementById('cfg-hero-badge').value,
    hero_title: document.getElementById('cfg-hero-title').value,
    hero_subtitle: document.getElementById('cfg-hero-subtitle').value,
    about_title: document.getElementById('cfg-about-title').value,
    about_content: document.getElementById('cfg-about-content').value,
    stats,
    contact: {
      email: document.getElementById('cfg-contact-email').value,
      qqGroup: document.getElementById('cfg-contact-qqGroup').value,
      wechat: document.getElementById('cfg-contact-wechat').value,
      location: document.getElementById('cfg-contact-location').value
    }
  };

  try {
    const res = await apiRequest('/portal/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(res.message, 'success');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 2. 入社申请审核中心 ====================

// 导出报名申请花名册 (Excel / CSV)
async function exportApplicationsExcel(format = 'excel') {
  const status = document.getElementById('audit-filter-status')?.value || 'all';
  const keyword = document.getElementById('audit-filter-keyword')?.value || '';
  const token = getToken();

  if (!token) {
    showToast('登录凭据已失效，请重新登录', 'error');
    return;
  }

  showToast(`正在生成 ${format.toUpperCase()} 报表，请稍候...`, 'info');

  try {
    const params = new URLSearchParams({
      status,
      keyword,
      format,
      token
    });

    const response = await fetch(`/api/applications/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || `导出失败 (${response.status})`);
    }

    // 提取文件名
    let filename = `社团招新报名花名册.${format === 'csv' ? 'csv' : 'xls'}`;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename*?=(?:UTF-8'')?([^;]+)/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1].replace(/["']/g, ''));
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    showToast('🎉 花名册导出成功！', 'success');
  } catch (err) {
    console.error('Export error:', err);
    showToast('导出失败: ' + err.message, 'error');
  }
}

async function loadApplications() {
  const tbody = document.getElementById('audit-table-body');
  const status = document.getElementById('audit-filter-status').value;
  const keyword = document.getElementById('audit-filter-keyword').value;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px;">加载中...</td></tr>`;

  try {
    let url = `/applications?status=${status}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

    const res = await apiRequest(url);
    if (res.success) {
      cachedApplications = res.data || [];

      // 更新统计数
      const allRes = await apiRequest('/applications?status=all');
      if (allRes.success && allRes.data) {
        const list = allRes.data;
        document.getElementById('stat-audit-total').innerText = list.length;
        document.getElementById('stat-audit-pending').innerText = list.filter(a => a.status === 'pending').length;
        document.getElementById('stat-audit-approved').innerText = list.filter(a => a.status === 'approved').length;
        document.getElementById('stat-audit-rejected').innerText = list.filter(a => a.status === 'rejected').length;
      }

      if (cachedApplications.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无符合筛选条件的申请记录</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedApplications.map(app => `
        <tr>
          <td><strong>#${app.id}</strong></td>
          <td>
            <div style="font-weight: 700;">${escapeHtml(app.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">UID: ${app.user_id}</div>
          </td>
          <td>
            <div>${escapeHtml(app.college)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(app.className)}</div>
          </td>
          <td>
            <div>QQ: ${escapeHtml(app.qq)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(app.email)}</div>
          </td>
          <td><span class="badge badge-admin">${escapeHtml(app.target_dept || '未指定')}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <a href="/api/applications/download-submission/${app.id}?token=${encodeURIComponent(getToken() || '')}" class="btn btn-outline btn-sm" download title="下载查看填写的申请表">
                📥 下载
              </a>
              <button class="btn btn-outline btn-sm" onclick="previewSubmission(${app.id})" title="在线预览申请表内容">
                👁️ 预览
              </button>
            </div>
          </td>
          <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(app.created_at)}</td>
          <td>${getStatusBadge(app.status)}</td>
          <td>
            <button class="btn ${app.status === 'pending' ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="openReviewModal(${app.id})">
              ${app.status === 'pending' ? '⚖️ 审核决议' : '🔍 查看详情'}
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--danger); padding: 20px;">加载失败: ${error.message}</td></tr>`;
  }
}

function openReviewModal(appId) {
  currentReviewAppId = appId;
  const app = cachedApplications.find(a => a.id == appId);
  if (!app) return;

  const container = document.getElementById('review-applicant-summary');
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div style="font-size: 17px; font-weight: 800; color: #0f172a;">${escapeHtml(app.name)} （${escapeHtml(app.college)} · ${escapeHtml(app.className)}）</div>
      ${getStatusBadge(app.status)}
    </div>
    <div style="font-size: 13.5px; color: #475569;">
      <span><strong>QQ：</strong>${escapeHtml(app.qq)}</span> &nbsp;|&nbsp; 
      <span><strong>邮箱：</strong>${escapeHtml(app.email)}</span> &nbsp;|&nbsp; 
      <span><strong>志愿部门：</strong><strong style="color: var(--primary);">${escapeHtml(app.target_dept || '未指定')}</strong></span>
    </div>
    ${app.statement ? `<div style="margin-top: 8px; font-size: 13px; background: #ffffff; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0;"><strong>个人特长/自述：</strong>${escapeHtml(app.statement)}</div>` : ''}
    <div style="margin-top: 10px;">
      <strong>申请表附件：</strong>
      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <a href="/api/applications/download-submission/${app.id}?token=${encodeURIComponent(getToken() || '')}" class="btn btn-outline btn-sm" download>
          📥 下载附件 (${escapeHtml(app.submission_filename || '申请表')})
        </a>
        <button class="btn btn-outline btn-sm" onclick="previewSubmission(${app.id})">
          👁️ 在线预览
        </button>
      </div>
    </div>
    ${app.reviewer_name ? `
      <div style="margin-top: 8px; font-size: 12.5px; color: var(--text-muted); border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        历史审核人: ${escapeHtml(app.reviewer_name)} | 审核时间: ${formatDateTime(app.reviewed_at)} | 评语: ${escapeHtml(app.review_notes || '无')}
      </div>
    ` : ''}
  `;

  // 默认备注
  document.getElementById('review-notes').value = app.review_notes || (app.status === 'pending' ? '欢迎加入社团，期待你的精彩表现！' : '');

  openModal('modal-review-app');
}

function previewSubmission(appId) {
  const app = cachedApplications.find(a => a.id == appId);
  if (!app) return;

  const filename = app.submission_filename || '申请表';
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const token = getToken();
  const previewUrl = `/api/applications/preview-submission/${appId}?token=${encodeURIComponent(token || '')}`;
  const downloadUrl = `/api/applications/download-submission/${appId}?token=${encodeURIComponent(token || '')}`;

  document.getElementById('preview-file-name').innerText = filename;
  document.getElementById('preview-download-link').href = downloadUrl;

  const container = document.getElementById('preview-container');
  container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><div class="loading-spinner" style="margin: 0 auto 16px;"></div>正在加载文件预览...</div>`;

  if (ext === 'pdf') {
    container.innerHTML = `<iframe src="${previewUrl}" style="width: 100%; min-height: 70vh; border: none;" onload="this.style.opacity='1';" onerror="document.getElementById('preview-container').innerHTML='<div style=text-align:center;padding:40px;color:var(--danger)>❌ PDF 加载失败，请尝试下载后查看</div>'"></iframe>`;
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; overflow: auto; max-height: 75vh;"><img src="${previewUrl}" alt="${filename}" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" onload="this.style.opacity='1';" onerror="this.parentElement.innerHTML='<div style=text-align:center;padding:40px;color:var(--danger)>❌ 图片加载失败</div>'"></div>`;
  } else if (ext === 'txt') {
    fetch(previewUrl)
      .then(r => r.text())
      .then(text => {
        container.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word; padding: 20px; margin: 0; font-size: 14px; line-height: 1.7; max-height: 70vh; overflow-y: auto; background: #fff;">${escapeHtml(text)}</pre>`;
      })
      .catch(() => {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger)">❌ 文本加载失败</div>`;
      });
  } else if (['doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">📑</div>
        <div style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">该文件为 Office 文档格式 (.${ext.toUpperCase()})</div>
        <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">浏览器不支持直接预览 Word / Excel 文件</div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <a href="${previewUrl}" class="btn btn-outline btn-sm" target="_blank">🔗 尝试浏览器打开</a>
          <a href="${downloadUrl}" class="btn btn-primary btn-sm" download>📥 立即下载</a>
        </div>
      </div>`;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">📎</div>
        <div style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">该文件格式不支持在线预览</div>
        <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">请下载后在本地使用对应软件打开</div>
        <a href="${downloadUrl}" class="btn btn-primary" download>📥 下载文件</a>
      </div>`;
  }

  openModal('modal-preview-submission');
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  if (!currentReviewAppId) return;

  const actionRadio = document.querySelector('input[name="review_action"]:checked');
  const action = actionRadio ? actionRadio.value : 'approve';
  const notes = document.getElementById('review-notes').value;

  const btn = document.getElementById('btn-submit-review');
  btn.disabled = true;
  btn.innerText = '正在提交并发送邮件通知...';

  try {
    const res = await apiRequest(`/applications/${currentReviewAppId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, review_notes: notes })
    });

    if (res.success) {
      closeModal('modal-review-app');
      showToast(res.message, 'success', 6000);
      loadApplications();
      checkPendingCount();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '提交审核并发送邮件通知';
  }
}

// ==================== 3. 申请表模板管理 ====================
async function loadTemplates() {
  const tbody = document.getElementById('templates-table-body');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px;">加载中...</td></tr>`;

  try {
    const res = await apiRequest('/applications/templates');
    if (res.success) {
      cachedTemplates = res.data || [];

      if (cachedTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">暂未上传任何模板文件</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedTemplates.map(tpl => `
        <tr>
          <td><strong>#${tpl.id}</strong></td>
          <td style="font-weight: 600;">${escapeHtml(tpl.title)}</td>
          <td style="font-size: 13px; color: var(--text-muted);">${escapeHtml(tpl.filename)}</td>
          <td>${formatFileSize(tpl.size)}</td>
          <td>${escapeHtml(tpl.uploader_name || '管理员')}</td>
          <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(tpl.created_at)}</td>
          <td>
            ${tpl.is_active ? '<span class="badge badge-member">✅ 当前生效 (默认下载)</span>' : '<span class="badge badge-user">备用存档</span>'}
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <a href="/api/applications/template/download/${tpl.id}" class="btn btn-outline btn-sm" download>📥 下载</a>
              ${!tpl.is_active ? `
                <button class="btn btn-primary btn-sm" onclick="setActiveTemplate(${tpl.id})">设为默认</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTemplate(${tpl.id})">🗑️ 删除</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">加载失败: ${error.message}</td></tr>`;
  }
}

async function handleUploadTemplate(e) {
  e.preventDefault();
  const fileInput = document.getElementById('tpl-file');
  if (!fileInput.files || !fileInput.files[0]) {
    showToast('请选择要上传的模板文件', 'warning');
    return;
  }

  const btn = document.getElementById('btn-upload-tpl');
  btn.disabled = true;
  btn.innerText = '正在上传...';

  const formData = new FormData();
  formData.append('title', document.getElementById('tpl-title').value);
  formData.append('set_active', document.getElementById('tpl-set-active').checked);
  formData.append('file', fileInput.files[0]);

  try {
    const res = await apiRequest('/applications/templates', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('form-upload-template').reset();
      loadTemplates();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 确认上传模板';
  }
}

async function setActiveTemplate(templateId) {
  try {
    const res = await apiRequest(`/applications/templates/${templateId}/active`, {
      method: 'PUT'
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadTemplates();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteTemplate(templateId) {
  const tpl = cachedTemplates.find(t => t.id === templateId);
  const name = tpl ? `「${tpl.title}」` : `#${templateId}`;

  if (!confirm(`⚠️ 确定要永久删除模板 ${name} 吗？\n\n此操作将同时移除服务器上的模板文件，且不可恢复！`)) {
    return;
  }

  try {
    const res = await apiRequest(`/applications/templates/${templateId}`, {
      method: 'DELETE'
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadTemplates();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 4. 通知公告管理 ====================
async function loadNoticesAdmin() {
  const tbody = document.getElementById('notices-table-body');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px;">加载中...</td></tr>`;

  try {
    const res = await apiRequest('/notices');
    if (res.success) {
      cachedNotices = res.data || [];

      if (cachedNotices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无任何公告</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedNotices.map(n => `
        <tr>
          <td><strong>#${n.id}</strong></td>
          <td style="font-weight: 600;">${escapeHtml(n.title)}</td>
          <td>
            ${n.category === 'member' ? '<span class="badge badge-super">🔒 社团成员专享</span>' : '<span class="badge badge-admin">🌐 全校公开</span>'}
          </td>
          <td><span class="badge badge-user">${escapeHtml(n.tag || '通知')}</span></td>
          <td>${escapeHtml(n.author_name || '管理组')}</td>
          <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(n.created_at)}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteNotice(${n.id})">🗑️ 删除</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--danger);">加载失败</td></tr>`;
  }
}

async function handlePublishNotice(e) {
  e.preventDefault();
  const title = document.getElementById('notice-title-input').value;
  const category = document.getElementById('notice-category-input').value;
  const tag = document.getElementById('notice-tag-input').value;
  const content = document.getElementById('notice-content-input').value;

  const btn = document.getElementById('btn-pub-notice');
  btn.disabled = true;

  try {
    const res = await apiRequest('/notices', {
      method: 'POST',
      body: JSON.stringify({ title, category, tag, content })
    });

    if (res.success) {
      showToast(res.message, 'success');
      document.getElementById('form-publish-notice').reset();
      loadNoticesAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteNotice(noticeId) {
  if (!confirm('确定要删除该通知公告吗？删除后前台将不再显示。')) return;

  try {
    const res = await apiRequest(`/notices/${noticeId}`, {
      method: 'DELETE'
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadNoticesAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 5. 成员与权限管理 (RBAC) ====================
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  const role = document.getElementById('user-filter-role').value;
  const keyword = document.getElementById('user-filter-keyword').value;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px;">加载中...</td></tr>`;
  await loadRegistrationLimit();

  try {
    let url = `/users?role=${role}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

    const res = await apiRequest(url);
    if (res.success) {
      cachedUsers = res.data || [];
      currentUser = getCurrentUser() || currentUser;
      const userRole = res.currentUserRole || (currentUser && currentUser.role);
      const isSuperAdmin = userRole === 'super_admin';

      if (cachedUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无符合筛选条件的用户</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedUsers.map(u => {
        let actionButtons = '';

        if (u.role === 'super_admin') {
          actionButtons = `<span class="badge badge-super">👑 系统全局唯一超管</span>`;
        } else {
          let quickBtns = '';

          if (u.role === 'user') {
            quickBtns = `
              <button class="btn btn-success btn-sm" onclick="quickChangeRole(${u.id}, 'member')" title="一键将该普通用户升级为正式社员">
                🌟 升为社员
              </button>
              ${isSuperAdmin ? `
                <button class="btn btn-secondary btn-sm" onclick="quickChangeRole(${u.id}, 'admin')" title="超管特权：直接任命为管理员">
                  👑 直升管理员
                </button>
              ` : ''}
            `;
          } else if (u.role === 'member') {
            quickBtns = `
              ${isSuperAdmin ? `
                <button class="btn btn-secondary btn-sm" onclick="quickChangeRole(${u.id}, 'admin')" title="超级管理员特权：任命为管理员">
                  👑 提拔管理员
                </button>
              ` : ''}
              <button class="btn btn-outline btn-sm" onclick="quickChangeRole(${u.id}, 'user')" style="color: var(--danger);" title="撤销社员身份，降为普通用户">
                降为用户
              </button>
            `;
          } else if (u.role === 'admin') {
            if (isSuperAdmin) {
              quickBtns = `
                <button class="btn btn-warning btn-sm" onclick="quickChangeRole(${u.id}, 'member')" title="撤销管理员职务，保留社团成员资格">
                  撤为社员
                </button>
                <button class="btn btn-danger btn-sm" onclick="quickChangeRole(${u.id}, 'user')" title="取消管理员与社员职务，降为普通用户">
                  降为用户
                </button>
              `;
            } else {
              quickBtns = `<span style="font-size: 12px; color: var(--text-muted);">同级管理员</span>`;
            }
          }

          actionButtons = `
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" onclick="openDispatchRoleModal(${u.id})" title="打开权限调度面板，自由配置系统角色">
                ⚙️ 权限调度
              </button>
              ${quickBtns}
              <button class="btn btn-outline btn-sm" onclick="resetUserPassword(${u.id})" title="重置该用户密码为统一初始密码 123456" style="color: #d97706; border-color: #d97706;">
                🔒 重置密码
              </button>
              <button class="btn btn-outline btn-sm" onclick="openSendEmailModal(${u.id})" title="向该用户发送自定义邮件" style="color: #6366f1; border-color: #6366f1;">
                📧 发送邮件
              </button>
              <button class="btn btn-outline btn-sm" onclick="deleteUserAccount(${u.id})" title="删除该用户账号及其所有关联数据" style="color: #ef4444; border-color: #ef4444;">
                🗑️ 删除账号
              </button>
            </div>
          `;
        }

        return `
          <tr>
            <td><strong>#${u.id}</strong></td>
            <td style="font-weight: 700;">${escapeHtml(u.name)}</td>
            <td>
              <div>${escapeHtml(u.college || '-')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(u.className || '-')}</div>
            </td>
            <td>${escapeHtml(u.qq || '-')}</td>
            <td style="font-size: 13px;">${escapeHtml(u.email || '-')}</td>
            <td>${getRoleBadge(u.role)}</td>
            <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(u.created_at)}</td>
            <td>${actionButtons}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">加载失败: ${error.message}</td></tr>`;
  }
}

async function loadRegistrationLimit() {
  const currentElement = document.getElementById('registration-limit-current');
  try {
    const res = await apiRequest('/users/registration-limit');
    if (res.success && res.data) {
      document.getElementById('registration-limit-input').value = res.data.limit;
      currentElement.innerText = `${res.data.current} 人`;
    }
  } catch (error) {
    currentElement.innerText = '读取失败';
    showToast(error.message, 'error');
  }
}

async function saveRegistrationLimit() {
  const input = document.getElementById('registration-limit-input');
  const limit = Number(input.value);
  if (!Number.isInteger(limit) || limit < 1) {
    showToast('请输入大于 0 的整数上限', 'warning');
    return;
  }

  try {
    const res = await apiRequest('/users/registration-limit', {
      method: 'PUT',
      body: JSON.stringify({ limit })
    });
    showToast(res.message, 'success');
    loadRegistrationLimit();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 打开“权限调度”模态框
function openDispatchRoleModal(userId) {
  const target = cachedUsers.find(u => u.id == userId);
  if (!target) {
    showToast('未找到该成员记录', 'error');
    return;
  }

  if (target.role === 'super_admin') {
    showToast('超级管理员拥有全局唯一系统最高权限，不可被调整', 'warning');
    return;
  }

  currentUser = getCurrentUser() || currentUser;
  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';

  document.getElementById('dispatch-target-user-id').value = target.id;

  // 渲染被操作用户基本信息
  document.getElementById('dispatch-user-summary').innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 16px; font-weight: 800; color: #0f172a;">${escapeHtml(target.name)}</span>
      ${getRoleBadge(target.role)}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; color: var(--text-muted);">
      <div>🏫 学院: <span style="color: #334155;">${escapeHtml(target.college || '-')}</span></div>
      <div>📚 专业班级: <span style="color: #334155;">${escapeHtml(target.className || '-')}</span></div>
      <div>📧 邮箱: <span style="color: #334155;">${escapeHtml(target.email || '-')}</span></div>
      <div>🐧 QQ号: <span style="color: #334155;">${escapeHtml(target.qq || '-')}</span></div>
    </div>
  `;

  // 默认选中当前该用户的系统角色
  const radios = document.getElementsByName('dispatch_role_choice');
  radios.forEach(r => {
    r.checked = (r.value === target.role);
  });

  // 普通管理员无权任命或调整管理员职务
  const adminRadio = document.querySelector('input[name="dispatch_role_choice"][value="admin"]');
  const adminLabel = document.getElementById('opt-role-admin');
  const adminHint = document.getElementById('admin-perm-hint');

  if (!isSuperAdmin) {
    adminRadio.disabled = true;
    adminLabel.style.opacity = '0.55';
    adminLabel.style.cursor = 'not-allowed';
    adminHint.innerText = '（仅超级管理员有权任命或撤职管理员）';
  } else {
    adminRadio.disabled = false;
    adminLabel.style.opacity = '1';
    adminLabel.style.cursor = 'pointer';
    adminHint.innerText = '';
  }

  openModal('modal-dispatch-role');
}

// 提交权限调度变更
async function handleDispatchRoleSubmit(event) {
  event.preventDefault();
  const userId = document.getElementById('dispatch-target-user-id').value;
  const selectedRole = document.querySelector('input[name="dispatch_role_choice"]:checked');
  if (!selectedRole) {
    showToast('请选择目标分配的系统角色', 'warning');
    return;
  }

  const role = selectedRole.value;
  const target = cachedUsers.find(u => u.id == userId);
  const userName = target ? target.name : `用户#${userId}`;
  const roleNameMap = { user: '普通用户', member: '社团成员', admin: '管理员' };

  if (target && target.role === role) {
    showToast(`用户【${userName}】当前已经是【${roleNameMap[role]}】，无需重复调度`, 'info');
    closeModal('modal-dispatch-role');
    return;
  }

  const btn = document.getElementById('btn-submit-dispatch-role');
  btn.disabled = true;
  btn.innerText = '正在调度权限...';

  try {
    const res = await apiRequest(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });

    if (res.success) {
      showToast(res.message || `已成功将【${userName}】调度为【${roleNameMap[role]}】！`, 'success');
      closeModal('modal-dispatch-role');
      loadUsers();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '确认调度权限';
  }
}

// 快捷单键权限调度
async function quickChangeRole(userId, targetRole) {
  const target = cachedUsers.find(u => u.id == userId);
  const userName = target ? target.name : `用户#${userId}`;
  const roleNameMap = { user: '普通用户', member: '社团成员', admin: '管理员' };
  const targetName = roleNameMap[targetRole] || targetRole;

  let confirmMsg = `确认将【${userName}】角色快速调度为【${targetName}】吗？`;
  if (targetRole === 'admin') {
    confirmMsg = `👑【超级管理员授权】确定要将【${userName}】提拔任命为【管理员】吗？\n任命后该用户将获得审核入社、编辑各页面、发布公告及决议活动的全部管理权限！`;
  }

  if (!confirm(confirmMsg)) return;

  try {
    const res = await apiRequest(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: targetRole })
    });

    if (res.success) {
      showToast(res.message, 'success');
      loadUsers();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 兼容旧版调用函数
function promoteToMember(userId) { return quickChangeRole(userId, 'member'); }
function promoteToAdmin(userId) { return quickChangeRole(userId, 'admin'); }
function demoteUser(userId, toRole) { return quickChangeRole(userId, toRole || 'user'); }

if (typeof window !== 'undefined') {
  window.openDispatchRoleModal = openDispatchRoleModal;
  window.handleDispatchRoleSubmit = handleDispatchRoleSubmit;
  window.quickChangeRole = quickChangeRole;
  window.promoteToMember = promoteToMember;
  window.promoteToAdmin = promoteToAdmin;
  window.demoteUser = demoteUser;
}

// ==================== 6. 邮件系统配置与发信日志 ====================
async function loadMailSettingsAndLogs() {
  if (currentUser.role === 'super_admin') {
    try {
      const res = await apiRequest('/mail/settings');
      if (res.success && res.data) {
        const s = res.data;
        document.getElementById('mail-host').value = s.smtp_host || 'smtp.qq.com';
        document.getElementById('mail-port').value = s.smtp_port || '465';
        document.getElementById('mail-user').value = s.smtp_user || '';
        document.getElementById('mail-from').value = s.smtp_from || s.smtp_user || '';
        document.getElementById('mail-sender-name').value = s.smtp_sender_name || '高校社团招新组';
        document.getElementById('mail-mock-mode').checked = s.mock_mode === 'true';

        if (s.has_pass) {
          document.getElementById('mail-pass-hint').innerText = '(已配置密码/授权码，留空则不修改)';
        }
      }
    } catch (e) {}
  }

  loadMailLogs();
}

async function saveMailSettings() {
  const payload = {
    smtp_host: document.getElementById('mail-host').value,
    smtp_port: document.getElementById('mail-port').value,
    smtp_secure: document.getElementById('mail-port').value === '465',
    smtp_user: document.getElementById('mail-user').value,
    smtp_from: document.getElementById('mail-from').value,
    smtp_sender_name: document.getElementById('mail-sender-name').value,
    mock_mode: document.getElementById('mail-mock-mode').checked
  };

  const pass = document.getElementById('mail-pass').value;
  if (pass) payload.smtp_pass = pass;

  try {
    const res = await apiRequest('/mail/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(res.message, 'success');
    }
  } catch (error) {
    showToast(`SMTP 配置失败：${error.message || '服务器未返回具体原因'}`, 'error', 6000);
  }
}

async function sendTestEmail() {
  const testEmail = document.getElementById('mail-test-to').value;
  if (!testEmail) {
    showToast('请输入测试收件邮箱', 'warning');
    return;
  }

  try {
    showToast('正在发送测试邮件...', 'info', 2000);
    const res = await apiRequest('/mail/test', {
      method: 'POST',
      body: JSON.stringify({ test_email: testEmail })
    });

    if (res.success) {
      showToast(res.message, 'success', 5000);
      loadMailLogs();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadMailLogs() {
  const tbody = document.getElementById('mail-logs-table-body');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px;">加载中...</td></tr>`;

  try {
    const res = await apiRequest('/mail/logs');
    if (res.success) {
      cachedMailLogs = res.data || [];

      if (cachedMailLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无发信记录</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedMailLogs.map(log => {
        let statusBadge = `<span class="badge badge-status-approved">已发送</span>`;
        if (log.status === 'simulated') {
          statusBadge = `<span class="badge badge-super" style="font-size:11px;">模拟信箱接收</span>`;
        } else if (log.status === 'failed') {
          statusBadge = `<span class="badge badge-status-rejected">发送失败</span>`;
        }

        return `
          <tr>
            <td><input type="checkbox" class="mail-log-checkbox" value="${log.id}" aria-label="选择发信日志 ${log.id}"></td>
            <td><strong>#${log.id}</strong></td>
            <td><strong>${escapeHtml(log.to_email)}</strong></td>
            <td>${escapeHtml(log.to_name || '-')}</td>
            <td style="font-weight: 600;">${escapeHtml(log.subject)}</td>
            <td>${statusBadge}</td>
            <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(log.created_at)}</td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="previewMail(${log.id})">🔍 查看邮件</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">加载失败: ${error.message}</td></tr>`;
  }
}

async function deleteSelectedMailLogs() {
  const ids = [...document.querySelectorAll('.mail-log-checkbox:checked')].map(input => Number(input.value));
  if (ids.length === 0) {
    showToast('请先选择要删除的发信日志', 'warning');
    return;
  }
  if (!confirm(`确定删除选中的 ${ids.length} 条发信日志吗？此操作不可撤回。`)) return;

  try {
    const res = await apiRequest('/mail/logs/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
    showToast(res.message, 'success');
    loadMailLogs();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function previewMail(logId) {
  const log = cachedMailLogs.find(l => l.id == logId);
  if (!log) return;

  document.getElementById('mail-preview-subject').innerText = log.subject;
  document.getElementById('mail-preview-to').innerText = `${log.to_name || ''} <${log.to_email}>`;
  document.getElementById('mail-preview-status').innerText = log.status === 'simulated' ? '内建模拟信箱安全存储 (未调用外部SMTP)' : (log.status === 'sent' ? '通过真实SMTP成功发送' : `发送失败: ${log.error_message || ''}`);
  document.getElementById('mail-preview-date').innerText = formatDateTime(log.created_at);
  document.getElementById('mail-preview-body').innerHTML = log.content;

  openModal('modal-mail-preview');
}

// ==================== 7. 网站页面管理 (增删改查与导航显隐) ====================
async function loadPagesAdmin() {
  const tbody = document.getElementById('pages-table-body');
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px;">加载中...</td></tr>`;

  try {
    const res = await apiRequest('/pages');
    if (res.success && Array.isArray(res.data)) {
      cachedPages = res.data;

      if (cachedPages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无网页记录</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedPages.map(p => `
        <tr>
          <td><strong>#${p.id}</strong></td>
          <td style="font-weight: 700; color: #0f172a;">${escapeHtml(p.title)}</td>
          <td><code>${escapeHtml(p.path)}</code></td>
          <td><span class="badge badge-admin">${escapeHtml(p.slug)}</span></td>
          <td>
            ${p.is_system ? '<span class="badge badge-super">🔒 系统核心页面</span>' : '<span class="badge badge-user">自定义新页面</span>'}
          </td>
          <td>
            ${p.is_nav_visible ? '<span class="badge badge-member">✅ 导航可见</span>' : '<span class="badge badge-status-rejected">已隐藏导航</span>'}
          </td>
          <td><strong>${p.sort_order}</strong></td>
          <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(p.updated_at || p.created_at)}</td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" onclick="openEditPageModal(${p.id})">✏️ 编辑</button>
              <a href="${p.path}" target="_blank" class="btn btn-secondary btn-sm">👁️ 预览</a>
              ${!p.is_system ? `
                <button class="btn btn-danger btn-sm" onclick="deletePageAdmin(${p.id})">🗑️ 删除</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--danger);">加载页面失败: ${err.message}</td></tr>`;
  }
}

function openCreatePageModal() {
  document.getElementById('page-modal-title').innerText = '➕ 新增自定义网页';
  document.getElementById('page-id-input').value = '';
  document.getElementById('page-title-input').value = '';
  document.getElementById('page-slug-input').value = '';
  document.getElementById('page-slug-input').readOnly = false;
  document.getElementById('page-sort-input').value = (cachedPages.length + 1) * 2;
  document.getElementById('page-nav-visible-input').checked = true;
  document.getElementById('page-desc-input').value = '';
  document.getElementById('page-content-input').value = '';
  document.getElementById('page-content-html-input').value = '';
  document.getElementById('default-template-fields').style.display = 'none';
  renderTemplateSpecificFields('', {});
  fillTemplateConfigForm({});
  openModal('modal-edit-page');
}

function openEditPageModal(pageId) {
  const page = cachedPages.find(p => p.id == pageId);
  if (!page) return;

  document.getElementById('page-modal-title').innerText = `✏️ 编辑网页 - ${page.title}`;
  document.getElementById('page-id-input').value = page.id;
  document.getElementById('page-title-input').value = page.title;
  document.getElementById('page-slug-input').value = page.slug;
  // 系统页面不允许随意改动路由 slug，保障核心路由稳定
  document.getElementById('page-slug-input').readOnly = Boolean(page.is_system);
  document.getElementById('page-sort-input').value = page.sort_order;
  document.getElementById('page-nav-visible-input').checked = Boolean(page.is_nav_visible);
  document.getElementById('page-desc-input').value = page.seo_description || '';
  document.getElementById('page-content-input').value = page.content || '';
  document.getElementById('page-content-html-input').value = page.content_html || '';
  document.getElementById('default-template-fields').style.display = page.is_system ? 'block' : 'none';
  renderTemplateSpecificFields(page.slug, page.template_config || {});
  fillTemplateConfigForm(page.template_config || {});

  openModal('modal-edit-page');
}

function fillTemplateConfigForm(config) {
  const template = typeof config === 'string' ? (() => {
    try { return JSON.parse(config || '{}'); } catch (error) { return {}; }
  })() : (config || {});
  document.getElementById('template-badge-input').value = template.badge || '';
  document.getElementById('template-banner-title-input').value = template.bannerTitle || '';
  document.getElementById('template-banner-description-input').value = template.bannerDescription || '';
  document.getElementById('template-intro-title-input').value = template.introTitle || '';
  document.getElementById('template-intro-content-input').value = template.introContent || '';
  document.querySelectorAll('[data-template-key]').forEach(input => {
    if (input.type === 'checkbox') {
      input.checked = template[input.dataset.templateKey] !== false;
    } else {
      input.value = template[input.dataset.templateKey] || '';
    }
  });
}

const templateFieldDefinitions = {
  home: [
    ['showHighlights', '显示首页优势卡片', 'checkbox'], ['showPillars', '显示首页核心能力区', 'checkbox'],
    ['showRecruitmentSteps', '显示首页纳新流程区', 'checkbox'], ['showNotices', '显示首页公告区', 'checkbox'],
    ['aboutSectionTitle', '关于板块标题', false], ['aboutSectionDescription', '关于板块说明', true],
    ['highlight1Title', '优势卡片 1 标题', false], ['highlight1Text', '优势卡片 1 内容', true],
    ['highlight2Title', '优势卡片 2 标题', false], ['highlight2Text', '优势卡片 2 内容', true],
    ['highlight3Title', '优势卡片 3 标题', false], ['highlight3Text', '优势卡片 3 内容', true],
    ['pillarSectionTitle', '核心能力区标题', false], ['pillarSectionDescription', '核心能力区说明', true],
    ['pillar1Title', '能力卡片 1 标题', false], ['pillar1Text', '能力卡片 1 内容', true],
    ['pillar2Title', '能力卡片 2 标题', false], ['pillar2Text', '能力卡片 2 内容', true],
    ['pillar3Title', '能力卡片 3 标题', false], ['pillar3Text', '能力卡片 3 内容', true],
    ['pillar4Title', '能力卡片 4 标题', false], ['pillar4Text', '能力卡片 4 内容', true],
    ['recruitmentSectionTitle', '纳新流程区标题', false], ['recruitmentSectionDescription', '纳新流程区说明', true],
    ['noticeSectionTitle', '公告区标题', false], ['noticeSectionDescription', '公告区说明', true]
  ],
  about: [
    ['showValues', '显示核心价值观区', 'checkbox'], ['showMilestones', '显示发展历程区', 'checkbox'], ['showHonors', '显示荣誉墙区', 'checkbox'],
    ['valuesTitle', '核心价值观区标题', false], ['valuesDescription', '核心价值观区说明', true],
    ['milestonesTitle', '发展历程区标题', false], ['milestonesDescription', '发展历程区说明', true],
    ['honorsTitle', '荣誉墙区标题', false], ['honorsDescription', '荣誉墙区说明', true],
    ['value1Title', '价值观卡片 1 标题', false], ['value1Text', '价值观卡片 1 内容', true],
    ['value2Title', '价值观卡片 2 标题', false], ['value2Text', '价值观卡片 2 内容', true],
    ['value3Title', '价值观卡片 3 标题', false], ['value3Text', '价值观卡片 3 内容', true],
    ['value4Title', '价值观卡片 4 标题', false], ['value4Text', '价值观卡片 4 内容', true],
    ['milestone1Year', '历程 1 年份/阶段', false], ['milestone1Title', '历程 1 标题', false], ['milestone1Text', '历程 1 内容', true],
    ['milestone2Year', '历程 2 年份/阶段', false], ['milestone2Title', '历程 2 标题', false], ['milestone2Text', '历程 2 内容', true],
    ['milestone3Year', '历程 3 年份/阶段', false], ['milestone3Title', '历程 3 标题', false], ['milestone3Text', '历程 3 内容', true],
    ['milestone4Year', '历程 4 年份/阶段', false], ['milestone4Title', '历程 4 标题', false], ['milestone4Text', '历程 4 内容', true],
    ['milestone5Year', '历程 5 年份/阶段', false], ['milestone5Title', '历程 5 标题', false], ['milestone5Text', '历程 5 内容', true],
    ['honor1Title', '荣誉卡片 1 标题', false], ['honor1Badge', '荣誉卡片 1 标签', false],
    ['honor2Title', '荣誉卡片 2 标题', false], ['honor2Badge', '荣誉卡片 2 标签', false],
    ['honor3Title', '荣誉卡片 3 标题', false], ['honor3Badge', '荣誉卡片 3 标签', false]
  ],
  recruitment: [
    ['showDownload', '显示申请表下载区', 'checkbox'], ['showApplication', '显示在线申请区', 'checkbox'], ['showFaq', '显示常见问题区', 'checkbox'],
    ['downloadStepLabel', '申请表下载区小标题', false], ['applicationTitle', '在线申请区标题', false],
    ['applicationDescription', '在线申请区说明', true], ['faqTitle', '常见问题区标题', false],
    ['faq1Question', '常见问题 1：问题', false], ['faq1Answer', '常见问题 1：答案', true],
    ['faq2Question', '常见问题 2：问题', false], ['faq2Answer', '常见问题 2：答案', true],
    ['faq3Question', '常见问题 3：问题', false], ['faq3Answer', '常见问题 3：答案', true],
    ['faq4Question', '常见问题 4：问题', false], ['faq4Answer', '常见问题 4：答案', true]
  ],
  notices: [
    ['showFilters', '显示公告筛选工具栏', 'checkbox'],
    ['filterAll', '全部分类按钮文字', false], ['filterPublic', '公开分类按钮文字', false],
    ['filterMember', '成员分类按钮文字', false], ['searchPlaceholder', '公告搜索框提示文字', false]
  ],
  contact: [
    ['showChannels', '显示联系方式卡片区', 'checkbox'], ['showInquiry', '显示在线咨询区', 'checkbox'], ['showGuide', '显示参访指南区', 'checkbox'],
    ['locationTitle', '地址卡片标题', false], ['locationHours', '地址卡片开放时间', false],
    ['emailTitle', '邮箱卡片标题', false], ['emailHint', '邮箱卡片说明', false],
    ['qqTitle', 'QQ群卡片标题', false], ['wechatTitle', '微信公众号卡片标题', false],
    ['inquiryTitle', '在线咨询区标题', false], ['inquiryDescription', '在线咨询区说明', true],
    ['guideTitle', '参访指南区标题', false]
  ]
};

function renderTemplateSpecificFields(slug, config) {
  const container = document.getElementById('template-specific-fields');
  if (!container) return;
  const fields = templateFieldDefinitions[slug] || [];
  container.innerHTML = fields.length === 0 ? '' : `
    <div style="border-top: 1px solid var(--border); padding-top: 14px; margin-top: 4px;">
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 10px;">${escapeHtml(slug === 'about' ? '关于我们专属文案' : slug === 'recruitment' ? '纳新通道专属文案' : slug === 'notices' ? '通知公告专属文案' : '联系方式专属文案')}</div>
      <div class="form-grid-2">
        ${fields.map(([key, label, multiline]) => `
          <div class="form-group">
            <label class="form-label">${escapeHtml(label)}</label>
            ${multiline === 'checkbox'
              ? `<label style="display:flex;align-items:center;gap:8px;margin-top:10px;"><input type="checkbox" data-template-key="${key}"> 启用此区块</label>`
              : multiline
              ? `<textarea class="form-control" data-template-key="${key}" rows="2" placeholder="${escapeHtml(label)}"></textarea>`
              : `<input type="text" class="form-control" data-template-key="${key}" placeholder="${escapeHtml(label)}">`}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function readTemplateConfigForm() {
  const config = {
    badge: document.getElementById('template-badge-input').value.trim(),
    bannerTitle: document.getElementById('template-banner-title-input').value.trim(),
    bannerDescription: document.getElementById('template-banner-description-input').value.trim(),
    introTitle: document.getElementById('template-intro-title-input').value.trim(),
    introContent: document.getElementById('template-intro-content-input').value.trim()
  };
  document.querySelectorAll('[data-template-key]').forEach(input => {
    config[input.dataset.templateKey] = input.type === 'checkbox' ? input.checked : input.value.trim();
  });
  return config;
}

function resetTemplateFields() {
  document.getElementById('template-badge-input').value = '';
  document.getElementById('template-banner-title-input').value = '';
  document.getElementById('template-banner-description-input').value = '';
  document.getElementById('template-intro-title-input').value = '';
  document.getElementById('template-intro-content-input').value = '';
  document.querySelectorAll('[data-template-key]').forEach(input => {
    if (input.type === 'checkbox') input.checked = true;
    else input.value = '';
  });
  showToast('已恢复默认模板文案和区块显示状态，点击保存后生效', 'info');
}

async function handleSavePage(e) {
  e.preventDefault();
  const pageId = document.getElementById('page-id-input').value;
  const isEditing = Boolean(pageId);

  const payload = {
    title: document.getElementById('page-title-input').value.trim(),
    slug: document.getElementById('page-slug-input').value.trim(),
    sort_order: parseInt(document.getElementById('page-sort-input').value, 10) || 10,
    is_nav_visible: document.getElementById('page-nav-visible-input').checked,
    seo_description: document.getElementById('page-desc-input').value.trim(),
    content: document.getElementById('page-content-input').value.trim(),
    content_html: document.getElementById('page-content-html-input').value.trim(),
    template_config: readTemplateConfigForm()
  };

  const btn = document.getElementById('btn-save-page');
  btn.disabled = true;
  btn.innerText = '正在保存...';

  try {
    let res;
    if (isEditing) {
      res = await apiRequest(`/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiRequest('/pages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res.success) {
      showToast(res.message, 'success');
      closeModal('modal-edit-page');
      loadPagesAdmin();
      // 同步刷新顶部共享导航菜单
      if (typeof loadDynamicNav === 'function') {
        loadDynamicNav();
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '💾 保存页面设置';
  }
}

async function deletePageAdmin(pageId) {
  const page = cachedPages.find(p => p.id == pageId);
  const name = page ? page.title : `页面#${pageId}`;
  if (!confirm(`确定要彻底删除自定义页面【${name}】吗？删除后该页面将从全站导航和路由中移除。`)) return;

  try {
    const res = await apiRequest(`/pages/${pageId}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message, 'success');
      loadPagesAdmin();
      if (typeof loadDynamicNav === 'function') {
        loadDynamicNav();
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== 8. 活动提案审核与举办决议 ====================
async function loadProposalsAdmin() {
  const tbody = document.getElementById('proposals-admin-table-body');
  const statusSelect = document.getElementById('proposal-admin-filter-status');
  const status = statusSelect ? statusSelect.value : 'all';
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px;">加载活动提案中...</td></tr>`;

  try {
    const res = await apiRequest(`/proposals?status=${status}`);
    if (res.success && Array.isArray(res.data)) {
      cachedAdminProposals = res.data;

      if (cachedAdminProposals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无符合筛选条件的活动提案</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedAdminProposals.map(p => {
        let statusBadge = '<span class="badge badge-super">🗳️ 投票中</span>';
        if (p.status === 'approved_to_hold') {
          statusBadge = '<span class="badge badge-member">🎉 决定举办</span>';
        } else if (p.status === 'rejected') {
          statusBadge = '<span class="badge badge-status-rejected">暂不举办</span>';
        }

        return `
          <tr>
            <td><input type="checkbox" class="proposal-checkbox" value="${p.id}" aria-label="选择活动提案 ${p.id}"></td>
            <td><strong>#${p.id}</strong></td>
            <td style="font-weight: 700; color: #0f172a;">${escapeHtml(p.title)}</td>
            <td><span class="badge badge-admin">${escapeHtml(p.category)}</span></td>
            <td>
              <div>${escapeHtml(p.creator_name)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(p.creator_college)}</div>
            </td>
            <td>
              <div>📅 ${escapeHtml(p.expected_time || '待定')}</div>
              <div style="font-size: 12px; color: var(--text-muted);">📍 ${escapeHtml(p.expected_location || '待定')}</div>
            </td>
            <td>${escapeHtml(p.budget || '待定')}</td>
            <td>
              <strong style="color: var(--primary); font-size: 16px;">${p.vote_count || 0}</strong> 票
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-primary btn-sm" onclick="openDecisionModal(${p.id})">
                  ${p.status === 'voting' ? '⚖️ 决议审批' : '✏️ 调整决议'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--danger);">加载失败: ${err.message}</td></tr>`;
  }
}

async function deleteSelectedProposals() {
  const ids = [...document.querySelectorAll('.proposal-checkbox:checked')].map(input => Number(input.value));
  if (ids.length === 0) {
    showToast('请先选择要删除的活动提案', 'warning');
    return;
  }
  if (!confirm(`确定删除选中的 ${ids.length} 个活动提案及其投票历史吗？此操作不可撤回。`)) return;

  try {
    const res = await apiRequest('/proposals/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids })
    });
    showToast(res.message, 'success');
    loadProposalsAdmin();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openDecisionModal(proposalId) {
  currentDecisionProposalId = proposalId;
  const p = cachedAdminProposals.find(item => item.id == proposalId);
  if (!p) return;

  const container = document.getElementById('proposal-admin-summary');
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div style="font-size: 17px; font-weight: 800; color: #0f172a;">${escapeHtml(p.title)}</div>
      <span class="badge badge-admin">${escapeHtml(p.category)}</span>
    </div>
    <div style="font-size: 13.5px; color: #475569; margin-bottom: 8px;">
      <span><strong>发起社员：</strong>${escapeHtml(p.creator_name)} (${escapeHtml(p.creator_college)})</span> &nbsp;|&nbsp;
      <span><strong>社员投票支持数：</strong><strong style="color: var(--primary);">${p.vote_count || 0} 票</strong></span> &nbsp;|&nbsp;
      <span><strong>预算：</strong>${escapeHtml(p.budget || '待定')}</span>
    </div>
    <div style="font-size: 13px; color: #475569; margin-bottom: 8px;">
      <span><strong>拟定时间与地点：</strong>${escapeHtml(p.expected_time || '待定')} · ${escapeHtml(p.expected_location || '待定')}</span>
    </div>
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; font-size: 13.5px; color: #334155; max-height: 140px; overflow-y: auto; white-space: pre-wrap;"><strong>活动要求与细节：</strong>&#10;${escapeHtml(p.details)}</div>
    ${p.admin_decision_notes ? `
      <div style="margin-top: 8px; font-size: 12.5px; color: var(--text-muted);">
        历史决议批复人: ${escapeHtml(p.decided_admin_name || '管理员')} | 时间: ${formatDateTime(p.decided_at)} | 意见: ${escapeHtml(p.admin_decision_notes)}
      </div>
    ` : ''}
  `;

  document.getElementById('prop-decision-notes').value = p.admin_decision_notes || (p.status === 'voting' ? '方案详实可行，社内投票热烈，管理团队一致批准筹备落地！' : '');

  // 默认勾选对应状态
  const radios = document.querySelectorAll('input[name="prop_decision_action"]');
  radios.forEach(r => {
    if (p.status === 'rejected') {
      r.checked = r.value === 'reject';
    } else {
      r.checked = r.value === 'approve';
    }
  });

  openModal('modal-decision-proposal');
}

async function handleProposalDecisionSubmit(e) {
  e.preventDefault();
  if (!currentDecisionProposalId) return;

  const actionRadio = document.querySelector('input[name="prop_decision_action"]:checked');
  const action = actionRadio ? actionRadio.value : 'approve';
  const notes = document.getElementById('prop-decision-notes').value.trim();

  const btn = document.getElementById('btn-submit-prop-decision');
  btn.disabled = true;
  btn.innerText = '正在提交决议...';

  try {
    const res = await apiRequest(`/proposals/${currentDecisionProposalId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action, notes })
    });

    if (res.success) {
      closeModal('modal-decision-proposal');
      showToast(res.message, 'success', 5000);
      loadProposalsAdmin();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '提交决议批复';
  }
}

// ==================== 9. 成员留言管理与官方答复 ====================
async function loadMessagesAdmin() {
  const tbody = document.getElementById('messages-admin-table-body');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px;">加载留言中...</td></tr>`;

  try {
    const res = await apiRequest('/messages');
    if (res.success && Array.isArray(res.data)) {
      cachedAdminMessages = res.data;

      if (cachedAdminMessages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">暂无成员留言</td></tr>`;
        return;
      }

      tbody.innerHTML = cachedAdminMessages.map(m => `
        <tr>
          <td><strong>#${m.id}</strong></td>
          <td style="font-weight: 700; color: #0f172a;">${escapeHtml(m.user_name)}</td>
          <td>
            ${getRoleBadge(m.user_role)}
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(m.user_college)}</div>
          </td>
          <td style="font-size: 13.5px; color: #334155; line-height: 1.6;">
            <div>${escapeHtml(m.content)}</div>
            ${m.admin_reply ? `
              <div style="margin-top: 6px; background: #f0fdf4; border-left: 3px solid var(--success); padding: 6px 10px; border-radius: 4px; font-size: 12.5px; color: #065f46;">
                <strong>🛡️ 官方回复 (${escapeHtml(m.reply_admin_name)})：</strong>${escapeHtml(m.admin_reply)}
              </div>
            ` : ''}
          </td>
          <td style="font-size: 12.5px; color: var(--text-muted);">${formatDateTime(m.created_at)}</td>
          <td>
            ${m.admin_reply ? '<span class="badge badge-member">✅ 已回复</span>' : '<span class="badge badge-user">⏳ 待回复</span>'}
          </td>
          <td>
            <button class="btn ${m.is_pinned ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="togglePinMessage(${m.id})">
              ${m.is_pinned ? '📌 已置顶' : '置顶'}
            </button>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="openReplyMessageModal(${m.id})">
                💬 答复
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteMessageAdmin(${m.id})">
                🗑️ 删除
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">加载留言失败: ${err.message}</td></tr>`;
  }
}

function openReplyMessageModal(messageId) {
  currentReplyMessageId = messageId;
  const m = cachedAdminMessages.find(item => item.id == messageId);
  if (!m) return;

  const container = document.getElementById('reply-msg-summary');
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
      <strong>${escapeHtml(m.user_name)}</strong>
      ${getRoleBadge(m.user_role)}
      <span style="font-size: 12px; color: var(--text-muted);">${formatDateTime(m.created_at)}</span>
    </div>
    <div style="font-size: 14px; color: #334155; line-height: 1.6; background: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0;">${escapeHtml(m.content)}</div>
  `;

  document.getElementById('msg-reply-input').value = m.admin_reply || '';
  openModal('modal-reply-message');
}

async function handleMessageReplySubmit(e) {
  e.preventDefault();
  if (!currentReplyMessageId) return;

  const reply = document.getElementById('msg-reply-input').value.trim();
  const btn = document.getElementById('btn-submit-msg-reply');
  btn.disabled = true;
  btn.innerText = '正在提交...';

  try {
    const res = await apiRequest(`/messages/${currentReplyMessageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply })
    });

    if (res.success) {
      closeModal('modal-reply-message');
      showToast(res.message, 'success');
      loadMessagesAdmin();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '提交官方答复';
  }
}

async function togglePinMessage(messageId) {
  try {
    const res = await apiRequest(`/messages/${messageId}/pin`, { method: 'PUT' });
    if (res.success) {
      showToast(res.message, 'success');
      loadMessagesAdmin();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMessageAdmin(messageId) {
  if (!confirm('确定要删除该留言吗？')) return;

  try {
    const res = await apiRequest(`/messages/${messageId}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message, 'success');
      loadMessagesAdmin();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== 10. 管理员重置用户密码 ====================
async function resetUserPassword(userId) {
  const target = cachedUsers.find(u => u.id == userId);
  const userName = target ? target.name : `用户#${userId}`;

  if (!confirm(`确定要重置【${userName}】的登录密码为统一初始密码【123456】吗？\n\n重置后该用户需使用新密码 123456 重新登录。此操作不可撤回！`)) {
    return;
  }

  try {
    const res = await apiRequest(`/users/${userId}/reset-password`, {
      method: 'POST'
    });

    if (res.success) {
      showToast(res.message, 'success', 6000);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 管理员/超管删除用户账号
async function deleteUserAccount(userId) {
  const target = cachedUsers.find(u => u.id == userId);
  const userName = target ? target.name : `用户#${userId}`;
  const roleName = target ? getRoleName(target.role) : '用户';

  if (!confirm(`⚠️ 高危操作确认\n\n确定要永久删除【${userName}】（${roleName}）的账号吗？\n\n此操作将同时删除该用户的所有：\n- 入社申请记录\n- 活动提案与投票\n- 留言互动\n\n此操作不可撤回！请再次确认！`)) {
    return;
  }

  // 二次确认
  if (!confirm(`🔴 最终确认：删除【${userName}】的账号\n\n请输入 "确认删除" 继续（直接点确定即可，此为最后提醒）`)) {
    return;
  }

  try {
    const res = await apiRequest(`/users/${userId}`, {
      method: 'DELETE'
    });

    if (res.success) {
      showToast(res.message, 'success', 6000);
      loadUsers();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 10.5 发展意向方向管理 ====================
let cachedDirections = [];

async function loadDirectionsAdmin() {
  const tbody = document.getElementById('directions-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;">加载中...</td></tr>';

  try {
    const res = await apiRequest('/directions/manage');
    if (res.success) {
      cachedDirections = res.data || [];
      if (cachedDirections.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">暂无发展方向选项，请点击「新增方向」</td></tr>';
        return;
      }
      tbody.innerHTML = cachedDirections.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:600;">${escapeHtml(d.title)}</td>
          <td>${d.sort_order}</td>
          <td>${d.is_active ? '<span class="badge badge-success">启用</span>' : '<span class="badge" style="background:#f1f5f9;color:#64748b;">停用</span>'}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-outline btn-sm" onclick="openEditDirectionModal(${d.id})">✏️ 编辑</button>
              <button class="btn btn-outline btn-sm" onclick="toggleDirectionActive(${d.id})" style="color:${d.is_active ? '#d97706' : '#059669'};border-color:${d.is_active ? '#d97706' : '#059669'};">${d.is_active ? '停用' : '启用'}</button>
              <button class="btn btn-outline btn-sm" onclick="deleteDirection(${d.id})" style="color:#ef4444;border-color:#ef4444;">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--danger);">加载失败: ${escapeHtml(error.message)}</td></tr>`;
  }
}

function openAddDirectionModal() {
  const title = prompt('请输入新的发展意向方向标题：');
  if (!title || !title.trim()) return;
  const order = prompt('请输入排序序号（数字越大越靠后，默认 0）：', '0');
  saveDirection({ title: title.trim(), sort_order: parseInt(order) || 0 });
}

function openEditDirectionModal(dirId) {
  const d = cachedDirections.find(x => x.id === dirId);
  if (!d) return;
  const title = prompt('修改方向标题：', d.title);
  if (title === null) return;
  const order = prompt('修改排序序号：', d.sort_order);
  if (order === null) return;
  const active = confirm('该方向是否设为「启用」状态？\n\n点「确定」= 启用，点「取消」= 停用');
  saveDirection({ id: dirId, title: title.trim(), sort_order: parseInt(order) || 0, is_active: active ? 1 : 0 });
}

async function saveDirection(data) {
  try {
    const method = data.id ? 'PUT' : 'POST';
    const url = data.id ? `/directions/${data.id}` : '/directions';
    if (data.id) delete data.id;
    const res = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (res.success) {
      showToast(res.message, 'success');
      loadDirectionsAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleDirectionActive(dirId) {
  const d = cachedDirections.find(x => x.id === dirId);
  if (!d) return;
  try {
    const res = await apiRequest(`/directions/${dirId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: d.is_active ? 0 : 1 })
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadDirectionsAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteDirection(dirId) {
  const d = cachedDirections.find(x => x.id === dirId);
  if (!d) return;
  if (!confirm(`确定要删除发展方向「${d.title}」吗？`)) return;
  try {
    const res = await apiRequest(`/directions/${dirId}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message, 'success');
      loadDirectionsAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 10.5b 活动类别管理 ====================
let cachedCategories = [];

async function loadCategoriesAdmin() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;">加载活动类别中...</td></tr>';
  try {
    const res = await apiRequest('/categories/manage');
    if (res.success) {
      cachedCategories = res.data || [];
      if (cachedCategories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#64748b;">暂无活动类别，点击「新增类别」开始创建</td></tr>';
        return;
      }
      tbody.innerHTML = cachedCategories.map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(c.title)}</strong></td>
          <td>${c.sort_order}</td>
          <td>${c.is_active ? '<span class="badge badge-member">启用</span>' : '<span class="badge" style="background:#f1f5f9;color:#94a3b8;">停用</span>'}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" onclick="openEditCategoryModal(${c.id})">✏️ 编辑</button>
              <button class="btn btn-outline btn-sm" onclick="toggleCategoryActive(${c.id})" style="color:${c.is_active ? '#d97706' : '#059669'};border-color:${c.is_active ? '#d97706' : '#059669'};">${c.is_active ? '停用' : '启用'}</button>
              <button class="btn btn-outline btn-sm" onclick="deleteCategory(${c.id})" style="color:#ef4444;border-color:#ef4444;">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#ef4444;">加载失败: ${error.message}</td></tr>`;
  }
}

function openAddCategoryModal() {
  const title = prompt('请输入新活动类别名称：');
  if (!title || !title.trim()) return;
  const order = prompt('请输入排序序号（数字越小越靠前，默认0）：', '0');
  saveCategory({ title: title.trim(), sort_order: parseInt(order) || 0 });
}

function openEditCategoryModal(catId) {
  const c = cachedCategories.find(x => x.id === catId);
  if (!c) return;
  const title = prompt('修改活动类别名称：', c.title);
  if (!title || !title.trim()) return;
  const order = prompt('修改排序序号：', c.sort_order);
  const active = confirm('该类别是否启用？\n「确定」= 启用，「取消」= 停用');
  saveCategory({ id: catId, title: title.trim(), sort_order: parseInt(order) || 0, is_active: active ? 1 : 0 });
}

async function saveCategory(data) {
  try {
    const method = data.id ? 'PUT' : 'POST';
    const url = data.id ? `/categories/${data.id}` : '/categories';
    const res = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (res.success) {
      showToast(res.message, 'success');
      loadCategoriesAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleCategoryActive(catId) {
  const c = cachedCategories.find(x => x.id === catId);
  if (!c) return;
  try {
    const res = await apiRequest(`/categories/${catId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: c.is_active ? 0 : 1 })
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadCategoriesAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteCategory(catId) {
  const c = cachedCategories.find(x => x.id === catId);
  if (!c) return;
  if (!confirm(`确定要删除活动类别「${c.title}」吗？`)) return;
  try {
    const res = await apiRequest(`/categories/${catId}`, { method: 'DELETE' });
    if (res.success) {
      showToast(res.message, 'success');
      loadCategoriesAdmin();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 10.6 角色升级申请审核 ====================
async function loadRoleApplicationsAdmin() {
  const tbody = document.getElementById('role-apps-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">加载中...</td></tr>';

  try {
    const res = await apiRequest('/directions/role-applications');
    if (res.success) {
      const apps = res.data || [];
      if (apps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted);">暂无角色升级申请</td></tr>';
        return;
      }
      const statusMap = { pending: '⏳ 待审核', approved: '✅ 已批准', rejected: '❌ 已驳回' };
      tbody.innerHTML = apps.map(a => `
        <tr>
          <td style="font-weight:600;">${escapeHtml(a.user_name)}</td>
          <td>${escapeHtml(a.user_email)}</td>
          <td>${getRoleBadge(a.current_role)}</td>
          <td>${escapeHtml(a.target_direction)}</td>
          <td style="max-width:200px;white-space:pre-wrap;font-size:13px;">${escapeHtml(a.reason || '-')}</td>
          <td style="font-size:12px;color:var(--text-muted);">${formatDateTime(a.created_at)}</td>
          <td>${statusMap[a.status] || a.status}</td>
          <td>
            ${a.status === 'pending' ? `
              <div style="display:flex;gap:6px;">
                <button class="btn btn-success btn-sm" onclick="reviewRoleApplication(${a.id},'approved')">✅ 批准晋升</button>
                <button class="btn btn-danger btn-sm" onclick="reviewRoleApplication(${a.id},'rejected')">❌ 驳回</button>
              </div>
            ` : (a.review_notes ? `<span style="font-size:12px;color:var(--text-muted);">${escapeHtml(a.review_notes.substring(0,30))}...</span>` : '<span style="font-size:12px;color:var(--text-muted);">-</span>')}
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);">加载失败: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function reviewRoleApplication(appId, status) {
  const notes = status === 'approved' ? '经管理组审核，批准晋升为管理员！' : (prompt('请输入驳回理由（可选）：') || '未通过管理员审核');
  try {
    const res = await apiRequest(`/directions/role-applications/${appId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes })
    });
    if (res.success) {
      showToast(res.message, 'success');
      loadRoleApplicationsAdmin();
      loadUsers();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== 11. 管理员向单个用户发送自定义邮件 ====================
let currentSendEmailUserId = null;
let cachedRecipients = [];

async function openSendEmailModal(userId) {
  currentSendEmailUserId = userId;
  const target = cachedUsers.find(u => u.id == userId);
  if (!target) {
    showToast('未找到该用户信息', 'error');
    return;
  }

  document.getElementById('send-email-recipient-info').innerHTML = `
    <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${escapeHtml(target.name)}</div>
    <div style="font-size: 13px; color: #64748b; margin-top: 2px;">
      ${escapeHtml(target.email)} &nbsp;|&nbsp; ${getRoleBadge(target.role)}
      &nbsp;|&nbsp; ${escapeHtml(target.college || '')} ${escapeHtml(target.className || '')}
    </div>
  `;

  document.getElementById('send-email-subject').value = '';
  document.getElementById('send-email-content').value = '';

  openModal('modal-send-email');
}

async function handleSendEmail(e) {
  e.preventDefault();
  if (!currentSendEmailUserId) return;

  const subject = document.getElementById('send-email-subject').value.trim();
  const html_content = document.getElementById('send-email-content').value.trim();

  if (!subject) {
    showToast('请输入邮件主题', 'warning');
    return;
  }

  if (!html_content) {
    showToast('请输入邮件正文内容', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-send-email');
  btn.disabled = true;
  btn.innerText = '正在发送邮件...';

  try {
    const res = await apiRequest('/mail/send', {
      method: 'POST',
      body: JSON.stringify({
        to_user_id: currentSendEmailUserId,
        subject: subject,
        html_content: html_content
      })
    });

    if (res.success) {
      closeModal('modal-send-email');
      showToast(res.message, 'success', 5000);
      loadMailLogs();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 确认发送邮件';
  }
}

async function openSendEmailModalAny() {
  currentSendEmailUserId = null;
  try {
    const res = await apiRequest('/mail/recipients');
    if (res.success) {
      cachedRecipients = res.data || [];

      const recipientSelect = document.getElementById('send-email-recipient-select');
      if (recipientSelect) {
        recipientSelect.innerHTML = '<option value="">-- 请选择收件人 --</option>' +
          cachedRecipients.map(u => `
            <option value="${u.id}">
              ${escapeHtml(u.name)} - ${escapeHtml(u.email)} (${getRoleName(u.role)})
            </option>
          `).join('');
      }
    }
  } catch (e) {
    console.error('Fetch recipients error:', e);
  }

  document.getElementById('send-email-recipient-info').innerHTML = `
    <div style="color: #64748b; font-size: 14px;">请从下拉列表中选择一位目标收件人</div>
  `;

  document.getElementById('send-email-subject').value = '';
  document.getElementById('send-email-content').value = '';

  openModal('modal-send-email');
}

function onRecipientSelectChanged() {
  const selectEl = document.getElementById('send-email-recipient-select');
  const userId = selectEl ? parseInt(selectEl.value) : null;

  if (!userId) {
    currentSendEmailUserId = null;
    document.getElementById('send-email-recipient-info').innerHTML = `
      <div style="color: #64748b; font-size: 14px;">请从下拉列表中选择一位目标收件人</div>
    `;
    return;
  }

  currentSendEmailUserId = userId;
  const target = cachedRecipients.find(u => u.id === userId) || cachedUsers.find(u => u.id === userId);
  if (target) {
    document.getElementById('send-email-recipient-info').innerHTML = `
      <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${escapeHtml(target.name)}</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 2px;">
        ${escapeHtml(target.email)} &nbsp;|&nbsp; ${getRoleBadge(target.role)}
        &nbsp;|&nbsp; ${escapeHtml(target.college || '')} ${escapeHtml(target.className || '')}
      </div>
    `;
  }
}