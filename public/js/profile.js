/**
 * 个人工作台与社员专区前端交互逻辑 (Member Profile & Cockpit JS)
 */

let currentUser = null;
let cachedApplications = [];
let cachedProposals = [];
let cachedMessages = [];
let cachedNotices = [];
let activeTab = 'overview';

// HTML 转义辅助函数
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = getCurrentUser();
  if (!currentUser) {
    showToast('请先登录后再访问个人工作台', 'warning');
    setTimeout(() => { window.location.href = '/?login=1'; }, 800);
    return;
  }

  // 同步最新用户信息（角色提权/最新信息）
  try {
    const freshUser = await syncCurrentUser();
    if (freshUser) {
      currentUser = freshUser;
    }
  } catch (e) {
    console.warn('Sync user failed:', e);
  }

  // 渲染侧边栏和顶部用户数据
  renderUserIdentity();

  // 根据 URL Hash 决定初始激活的 Tab，默认 overview
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['overview', 'application', 'profile', 'proposals', 'messages', 'notices'];
  if (validTabs.includes(hash)) {
    activeTab = hash;
  }
  switchProfileTab(activeTab);

  // 加载全量数据
  await refreshProfileData();
});

// 全局刷新数据
async function refreshProfileData() {
  loadDirectionsForDropdowns();
  loadCategoriesForDropdown();
  renderQuickActions();
  renderAppTabActions();
  await Promise.allSettled([
    loadMyApplications(),
    loadProposals(),
    loadMessages(),
    loadMemberNotices()
  ]);
  renderOverviewPane();
}

// 侧边栏与用户基础卡片渲染
function renderUserIdentity() {
  if (!currentUser) return;

  const firstChar = escapeHtml((currentUser.name || 'U').slice(0, 1));
  const roleBadge = getRoleBadge(currentUser.role);

  // 侧边栏
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (avatarEl) avatarEl.innerText = firstChar;

  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) nameEl.innerText = currentUser.name;

  const badgeEl = document.getElementById('sidebar-user-badge');
  if (badgeEl) badgeEl.innerHTML = roleBadge;

  // 顶部操作栏
  const topbarUserEl = document.getElementById('topbar-user-chip');
  if (topbarUserEl) {
    topbarUserEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; color: #1e293b;">${escapeHtml(currentUser.name)}</span>
        ${roleBadge}
      </div>
    `;
  }

  // 管理后台快捷入口（若有权限）
  const adminSlot = document.getElementById('sidebar-admin-slot');
  if (adminSlot && ['admin', 'super_admin'].includes(currentUser.role)) {
    adminSlot.style.display = 'block';
  }

  // 资料表单填充
  const editName = document.getElementById('edit-name');
  if (editName) editName.value = currentUser.name || '';
  const editCollege = document.getElementById('edit-college');
  if (editCollege) editCollege.value = currentUser.college || '';
  const editClass = document.getElementById('edit-class');
  if (editClass) editClass.value = currentUser.className || '';
  const editQq = document.getElementById('edit-qq');
  if (editQq) editQq.value = currentUser.qq || '';
  const editEmail = document.getElementById('edit-email');
  if (editEmail) editEmail.value = currentUser.email || '';
}

// Tab 切换引擎
const TAB_TITLES = {
  overview: { title: '📊 工作台总览与社员数字中枢', subtitle: '个人综合状态概览、特权凭据与快捷服务' },
  application: { title: '📋 入社申请全流程追踪', subtitle: '申请表提交、实时阅卷进度与官方反馈意见' },
  profile: { title: '👤 个人资料与账号安全', subtitle: '维护学籍、学院班级与联络方式' },
  proposals: { title: '🎯 活动共创提案与全员表决', subtitle: '民主发起活动倡议、点赞投票与官方决议公示' },
  messages: { title: '💬 社内交流互动留言板', subtitle: '社员技术交流、生活趣事与管理员官方回复' },
  notices: { title: '🔒 社内专属通知与规章备忘', subtitle: '内部规章制度、例会备忘与工位实验规范' }
};

function switchProfileTab(tabKey) {
  if (!TAB_TITLES[tabKey]) tabKey = 'overview';
  activeTab = tabKey;

  // 更新导航选中态
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
  const targetNav = document.getElementById(`nav-tab-${tabKey}`);
  if (targetNav) targetNav.classList.add('active');

  // 更新内容面板
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const targetPane = document.getElementById(`pane-${tabKey}`);
  if (targetPane) targetPane.classList.add('active');

  // 更新顶部标题
  const topTitle = document.getElementById('topbar-page-title');
  if (topTitle) {
    topTitle.innerHTML = `
      <div>
        <div style="font-size: 18px; font-weight: 800; color: #1e293b;">${TAB_TITLES[tabKey].title}</div>
        <div style="font-size: 12px; font-weight: 400; color: #64748b; margin-top: 2px;">${TAB_TITLES[tabKey].subtitle}</div>
      </div>
    `;
  }

  // 更新 URL Hash
  if (window.location.hash !== `#${tabKey}`) {
    history.replaceState(null, '', `#${tabKey}`);
  }

  // 关闭移动端抽屉
  closeMobileSidebar();
}

// 移动端侧边栏切换
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && overlay) {
    const isOpen = sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && overlay) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ==================== Tab 1: 工作台总览 (Overview) ====================
function renderOverviewPane() {
  if (!currentUser) return;

  const isOfficialMember = ['member', 'admin', 'super_admin'].includes(currentUser.role);
  const latestApp = cachedApplications[0] || null;

  // 1. 统计微卡片
  const statRole = document.getElementById('stat-user-role');
  if (statRole) {
    statRole.innerHTML = getRoleBadge(currentUser.role);
  }

  const statApp = document.getElementById('stat-app-status');
  if (statApp) {
    if (!latestApp) {
      statApp.innerHTML = `<span class="badge" style="background:#f1f5f9; color:#64748b;">未提交</span>`;
    } else {
      statApp.innerHTML = getStatusBadge(latestApp.status);
    }
  }

  const statProposals = document.getElementById('stat-active-proposals');
  if (statProposals) {
    const votingCount = cachedProposals.filter(p => p.status === 'voting').length;
    statProposals.innerText = votingCount;
  }

  const statMsgs = document.getElementById('stat-total-messages');
  if (statMsgs) {
    statMsgs.innerText = cachedMessages.length;
  }

  // 2. 社员认证证书卡片 vs 待解锁卡片
  const certSlot = document.getElementById('overview-cert-slot');
  if (certSlot) {
    if (isOfficialMember) {
      certSlot.innerHTML = `
        <div class="member-cert-hero">
          <div class="cert-top-row">
            <div>
              <div class="cert-stamp-badge">YOUTH GEEK CLUB · VERIFIED IDENTITY</div>
              <div class="cert-member-title">🎉 社团官方认证成员凭证</div>
            </div>
            <div style="font-size: 36px; line-height: 1;">🎖️</div>
          </div>
          <div style="font-size: 15px; opacity: 0.95;">
            持证社员：<strong>${escapeHtml(currentUser.name)}</strong> · ${escapeHtml(currentUser.college || '极客工坊')} (${escapeHtml(currentUser.className || '全栈梯队')})
          </div>
          <div class="cert-meta-grid">
            <div><strong>🪪 凭据编号：</strong>MEMBER-${String(currentUser.id).padStart(5, '0')}</div>
            <div><strong>🎓 认证权限：</strong>${getRoleName(currentUser.role)}</div>
            <div><strong>🏛️ 签发机构：</strong>发明创新协会</div>
            <div><strong>📅 状态：</strong>已激活生效中</div>
          </div>
          <div class="cert-perks-list">
            <span class="cert-perk-pill">⚡ 竞赛指导</span>
            <span class="cert-perk-pill">🚀 专利撰写指导</span>
            <span class="cert-perk-pill">🗳️ 社团活动发起与决议投票</span>
            <span class="cert-perk-pill">💬 社内交流发言畅聊</span>
            <span class="cert-perk-pill">📄 创新创业学分</span>
          </div>
        </div>
      `;
    } else {
      certSlot.innerHTML = `
        <div class="member-locked-hero">
          <div class="member-locked-icon">🔒</div>
          <h3 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">社团官方成员权益待点亮</h3>
          <p style="font-size: 14px; color: #64748b; max-width: 580px; margin: 0 auto 20px auto; line-height: 1.6;">
            您当前账户身份为【普通用户】。填写并上传《入社申请表》，通过管理组审核晋升为正式【社团成员】后，即可点亮专属数字荣誉徽章，解锁 302 工位预约与算力资源！
          </p>
          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="/api/applications/template/download" class="btn btn-outline" download>📥 下载申请表模板</a>
            <button class="btn btn-primary" onclick="openModal('modal-submit-app')">✍️ 立即提交入社申请</button>
          </div>
        </div>
      `;
    }
  }

  // 3. 申请动态速览卡片
  const appPreviewSlot = document.getElementById('overview-app-preview');
  if (appPreviewSlot) {
    if (!latestApp) {
      appPreviewSlot.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #64748b;">
          您尚未提交过入社申请，<a href="javascript:void(0)" onclick="openModal('modal-submit-app')" style="color: var(--primary); font-weight: 600;">点击此处立即提交</a>。
        </div>
      `;
    } else {
      appPreviewSlot.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <div>
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              志愿方向：${escapeHtml(latestApp.target_dept || '未指定')} · 申请单 #${latestApp.id}
            </div>
            <div style="font-size: 12.5px; color: #64748b;">提交时间：${formatDateTime(latestApp.created_at)}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${getStatusBadge(latestApp.status)}
            <button class="btn btn-outline btn-sm" onclick="switchProfileTab('application')">查看详情 &rarr;</button>
          </div>
        </div>
      `;
    }
  }
}

// ==================== 快捷服务通道动态渲染 & 发展意向方向加载 ====================
async function loadDirectionsForDropdowns() {
  try {
    const res = await apiRequest('/directions');
    if (res.success && res.data) {
      const options = res.data.map(d =>
        `<option value="${escapeHtml(d.title)}">${escapeHtml(d.title)}</option>`
      ).join('');

      const deptSelect = document.getElementById('app-target-dept');
      if (deptSelect) {
        deptSelect.innerHTML = `<option value="">-- 请选择申请意向方向 --</option>${options}`;
      }

      const adminSelect = document.getElementById('admin-app-direction');
      if (adminSelect) {
        adminSelect.innerHTML = `<option value="">-- 请选择发展意向方向 --</option>${options}`;
      }
    }
  } catch (e) {
    console.error('Load directions failed:', e);
  }
}

async function loadCategoriesForDropdown() {
  try {
    const res = await apiRequest('/categories');
    if (res.success && res.data) {
      const options = res.data.map(c =>
        `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`
      ).join('');

      const catSelect = document.getElementById('prop-category');
      if (catSelect) {
        catSelect.innerHTML = `<option value="">-- 请选择活动类别 --</option>${options}`;
      }
    }
  } catch (e) {
    console.error('Load categories failed:', e);
  }
}

function renderQuickActions() {
  const grid = document.getElementById('quick-actions-grid');
  if (!grid || !currentUser) return;

  const isMember = ['member', 'admin', 'super_admin'].includes(currentUser.role);
  const isAdmin = ['admin', 'super_admin'].includes(currentUser.role);

  const btnStyle = 'justify-content:flex-start;padding:14px 16px;height:auto;';
  const titleStyle = 'font-weight:700;color:#1e293b;font-size:14px;';
  const descStyle = 'font-size:12px;color:#64748b;margin-top:2px;';

  let actions = '';

  if (!isMember && !isAdmin) {
    actions += `
      <button class="btn btn-outline" style="${btnStyle}" onclick="openModal('modal-submit-app')">
        <div><div style="${titleStyle}">✍️ 递交入社申请</div><div style="${descStyle}">上传完整申请表附件</div></div>
      </button>`;
  }

  if (isMember && !isAdmin) {
    actions += `
      <button class="btn btn-outline" style="${btnStyle};border-color:#f59e0b;" onclick="openModal('modal-apply-admin')">
        <div><div style="${titleStyle}">👑 申请晋升管理员</div><div style="${descStyle}">意向申请发展方向</div></div>
      </button>`;
  }

  actions += `
    <button class="btn btn-outline" style="${btnStyle}" onclick="openNewProposalModal()">
      <div><div style="${titleStyle}">💡 发起活动共创</div><div style="${descStyle}">民主提议技术沙龙</div></div>
    </button>

    <button class="btn btn-outline" style="${btnStyle}" onclick="switchProfileTab('messages')">
      <div><div style="${titleStyle}">💬 社内畅聊提问</div><div style="${descStyle}">向管理团队提出疑问</div></div>
    </button>

    <a href="/api/applications/template/download" class="btn btn-outline" style="${btnStyle}" download>
      <div><div style="${titleStyle}">📥 下载申请模板</div><div style="${descStyle}">最新 .docx 规范样表</div></div>
    </a>`;

  grid.innerHTML = actions;
}

function renderAppTabActions() {
  const container = document.getElementById('app-tab-actions');
  if (!container || !currentUser) return;

  const isMember = ['member', 'admin', 'super_admin'].includes(currentUser.role);
  const isAdmin = ['admin', 'super_admin'].includes(currentUser.role);

  let html = '<a href="/api/applications/template/download" class="btn btn-outline btn-sm" download>📥 下载申请表模板</a>';

  if (!isMember && !isAdmin) {
    html += '<button class="btn btn-primary btn-sm" onclick="openModal(\'modal-submit-app\')">✍️ 提交/补充申请表</button>';
  }

  if (isMember && !isAdmin) {
    html += '<button class="btn btn-primary btn-sm" onclick="openModal(\'modal-apply-admin\')" style="background:#f59e0b;border-color:#f59e0b;">👑 申请晋升管理员</button>';
  }

  container.innerHTML = html;
}

async function handleAdminApplicationSubmit(e) {
  e.preventDefault();
  const direction = document.getElementById('admin-app-direction').value;
  const reason = document.getElementById('admin-app-reason').value;

  if (!direction) {
    showToast('请选择意向申请发展方向', 'warning');
    return;
  }

  const btn = document.getElementById('btn-apply-admin-action');
  btn.disabled = true;
  btn.innerText = '正在提交...';

  try {
    const res = await apiRequest('/directions/role-applications', {
      method: 'POST',
      body: JSON.stringify({ target_direction: direction, reason })
    });
    if (res.success) {
      showToast(res.message, 'success');
      closeModal('modal-apply-admin');
      document.getElementById('form-apply-admin').reset();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '提交晋升申请';
  }
}

// ==================== Tab 2: 入社申请追踪 (Application) ====================
async function loadMyApplications() {
  const container = document.getElementById('application-status-container');
  if (!container) return;

  try {
    const res = await apiRequest('/applications/my');
    if (res.success) {
      cachedApplications = res.data || [];

      if (cachedApplications.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 24px; background: #ffffff; border-radius: var(--radius-lg); border: 2px dashed #cbd5e1;">
            <div style="font-size: 42px; margin-bottom: 12px;">📄</div>
            <h3 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">您尚未提交过入社申请</h3>
            <p style="font-size: 14px; color: #64748b; max-width: 520px; margin: 0 auto 20px auto; line-height: 1.6;">
              加入高校极客社团，和全校最强极客一起写代码、打比赛、孵化创新创业项目！请先下载官方申请表，填写完整后上传。
            </p>
            <div style="display: flex; justify-content: center; gap: 12px;">
              <a href="/api/applications/template/download" class="btn btn-outline" download>📥 下载申请表模板</a>
              <button class="btn btn-primary" onclick="openModal('modal-submit-app')">✍️ 立即提交申请表</button>
            </div>
          </div>
        `;
        return;
      }

      const latest = cachedApplications[0];

      // 时间线步骤状态计算
      let step1Class = 'completed';
      let step2Class = 'active';
      let step3Class = '';
      let step3Label = '录取结果发布';

      if (latest.status === 'approved') {
        step2Class = 'completed';
        step3Class = 'completed';
        step3Label = '🎉 审核通过 (已录取)';
      } else if (latest.status === 'rejected') {
        step2Class = 'completed';
        step3Class = 'rejected';
        step3Label = '⚠️ 暂未通过';
      }

      container.innerHTML = `
        <div class="app-status-box">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 16px;">
            <div>
              <span style="font-size: 13px; color: #64748b;">申请批次编号：<strong>#APP-${latest.id}</strong></span>
              <span style="font-size: 13px; color: #64748b; margin-left: 14px;">提交于：${formatDateTime(latest.created_at)}</span>
            </div>
            <div>${getStatusBadge(latest.status)}</div>
          </div>

          <!-- 视觉步骤条 -->
          <div class="app-timeline-steps">
            <div class="step-node ${step1Class}">
              <div class="step-node-circle">1</div>
              <div class="step-node-label">已成功递交</div>
            </div>
            <div class="step-node ${step2Class}">
              <div class="step-node-circle">2</div>
              <div class="step-node-label">团队阅卷与审核</div>
            </div>
            <div class="step-node ${step3Class}">
              <div class="step-node-circle">3</div>
              <div class="step-node-label">${step3Label}</div>
            </div>
          </div>

          <!-- 详细信息卡片 -->
          <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; font-size: 14px;">
              <div><strong>申请意向发展方向：</strong><span class="badge badge-admin">${escapeHtml(latest.target_dept || '未指定')}</span></div>
              <div>
                <strong>已提交附件：</strong>
                <a href="/api/applications/download-submission/${latest.id}?token=${encodeURIComponent(getToken() || '')}" class="btn btn-outline btn-sm" style="margin-left: 6px; padding: 2px 10px;" download>
                  📥 ${escapeHtml(latest.submission_filename || '申请表附件')}
                </a>
              </div>
            </div>
            ${latest.statement ? `
              <div style="margin-top: 14px; font-size: 14px; line-height: 1.7; color: #334155; border-top: 1px solid var(--border-light); padding-top: 12px;">
                <strong>个人自述与特长：</strong><br>
                ${escapeHtml(latest.statement)}
              </div>
            ` : ''}
          </div>

          <!-- 审核批复与建议提示框 -->
          ${latest.status === 'approved' ? `
            <div class="alert alert-success">
              🎉 <strong>审核通过喜报：</strong>恭喜！您的入社申请已通过官方审核，您已正式晋升为【社团成员】！录取通知邮件已同步发送至您的注册邮箱，请注意查阅！
              ${latest.review_notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(6,95,70,0.2);"><strong>导师评语：</strong>${escapeHtml(latest.review_notes)}</div>` : ''}
            </div>
          ` : ''}

          ${latest.status === 'rejected' ? `
            <div class="alert alert-warning">
              ⚠️ <strong>审核结果告知：</strong>本次入社申请暂未通过。
              ${latest.review_notes ? `<div style="margin-top: 6px;"><strong>反馈意见：</strong>${escapeHtml(latest.review_notes)}</div>` : ''}
              <div style="margin-top: 10px;">
                社团鼓励积极探索与精进技能，您可以完善个人特长经历或学习项目后，随时重新提交申请！
              </div>
            </div>
          ` : ''}

          ${latest.status === 'pending' ? `
            <div class="alert alert-info">
              ⏳ <strong>正在阅卷中：</strong>社团管理团队与各方向负责人正在认真查阅您的申请材料。决议做出后系统将<strong>自动发送邮件通知</strong>，请耐心等候！
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
            <a href="/api/applications/template/download" class="btn btn-outline btn-sm" download>📥 重新下载申请表模板</a>
            <button class="btn btn-primary btn-sm" onclick="openModal('modal-submit-app')">
              ✍️ ${latest.status === 'rejected' ? '重新提交申请表' : '更新/补充申请表'}
            </button>
          </div>
        </div>
      `;
    }
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger">加载申请进度失败: ${error.message}</div>`;
  }
}

// 申请表上传交互
function handleFileSelected(input) {
  const tip = document.getElementById('app-file-tip');
  if (input.files && input.files[0]) {
    tip.innerText = `已选择附件: ${input.files[0].name} (${formatFileSize(input.files[0].size)})`;
    tip.style.color = 'var(--primary)';
  }
}

async function handleApplicationSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('app-file-input');
  if (!fileInput.files || !fileInput.files[0]) {
    showToast('请选择填写好的申请表附件文件', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-action');
  btn.disabled = true;
  btn.innerText = '正在上传提交...';

  const formData = new FormData();
  formData.append('target_dept', document.getElementById('app-target-dept').value);
  formData.append('statement', document.getElementById('app-statement').value);
  formData.append('file', fileInput.files[0]);

  try {
    const res = await apiRequest('/applications/submit', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      closeModal('modal-submit-app');
      showToast(res.message, 'success', 6000);
      await loadMyApplications();
      renderOverviewPane();
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '确认提交入社申请';
  }
}

// ==================== Tab 3: 个人资料与设置 (Profile) ====================
async function handleUpdateProfile(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('edit-name').value.trim(),
    college: document.getElementById('edit-college').value.trim(),
    className: document.getElementById('edit-class').value.trim(),
    qq: document.getElementById('edit-qq').value.trim()
  };

  if (!payload.name) {
    showToast('姓名不能为空', 'warning');
    return;
  }

  try {
    const res = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(res.message, 'success');
      currentUser = res.user;
      setCurrentUser(currentUser);
      renderUserIdentity();
      renderOverviewPane();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// 修改密码
async function handleChangePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('change-current-password').value;
  const newPassword = document.getElementById('change-new-password').value;
  const confirmPassword = document.getElementById('change-confirm-password').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('请完整填写当前密码、新密码和确认密码', 'warning');
    return;
  }

  if (newPassword.length < 6) {
    showToast('新密码长度至少为 6 位', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致，请重新确认', 'warning');
    return;
  }

  try {
    const res = await apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (res.success) {
      showToast(res.message, 'success', 5000);
      document.getElementById('form-change-password').reset();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==================== Tab 4: 活动提案与决议 (Proposals) ====================
function openNewProposalModal() {
  if (!['member', 'admin', 'super_admin'].includes(currentUser.role)) {
    showToast('🔒 发起提案为【社团成员】专享权益，请先提交申请晋升为社员！', 'warning', 5000);
    return;
  }
  openModal('modal-new-proposal');
}

async function handleCreateProposal(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-prop');
  btn.disabled = true;
  btn.innerText = '正在提交提案...';

  const payload = {
    title: document.getElementById('prop-title').value.trim(),
    category: document.getElementById('prop-category').value,
    expected_time: document.getElementById('prop-time').value.trim(),
    expected_location: document.getElementById('prop-location').value.trim(),
    budget: document.getElementById('prop-budget').value.trim(),
    description: document.getElementById('prop-desc').value.trim(),
    details: document.getElementById('prop-details').value.trim()
  };

  try {
    const res = await apiRequest('/proposals', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      showToast(res.message, 'success', 5000);
      closeModal('modal-new-proposal');
      document.getElementById('form-new-proposal').reset();
      await loadProposals();
      renderOverviewPane();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '确认提交活动提案并开启投票';
  }
}

async function loadProposals() {
  const container = document.getElementById('proposals-list-container');
  if (!container) return;

  const statusSelect = document.getElementById('proposal-filter-status');
  const status = statusSelect ? statusSelect.value : 'all';

  try {
    const res = await apiRequest(`/proposals?status=${status}`);
    if (res.success && Array.isArray(res.data)) {
      cachedProposals = res.data;

      if (cachedProposals.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; color: #64748b; background: #ffffff; border-radius: var(--radius-lg); border: 2px dashed #cbd5e1;">
            <div style="font-size: 36px; margin-bottom: 10px;">🗳️</div>
            <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">暂无该类别的活动提案</div>
            <p style="font-size: 13.5px; max-width: 460px; margin: 0 auto 18px auto;">社团提倡全员民主共创，有任何好玩的讲座、比赛、沙龙构想，都可以点击右上角发起！</p>
            <button class="btn btn-primary btn-sm" onclick="openNewProposalModal()">💡 发起新活动提案</button>
          </div>
        `;
        return;
      }

      container.innerHTML = cachedProposals.map(p => {
        let statusBadge = '';
        if (p.status === 'approved_to_hold') {
          statusBadge = `<span class="badge badge-member">🎉 管理员已决定举办</span>`;
        } else if (p.status === 'rejected') {
          statusBadge = `<span class="badge badge-status-rejected">暂不举办</span>`;
        } else {
          statusBadge = `<span class="badge badge-super">🗳️ 社内投票中</span>`;
        }

        const canVote = ['member', 'admin', 'super_admin'].includes(currentUser.role);

        return `
          <div class="proposal-card-item">
            <div class="proposal-header-row">
              <div style="flex-grow: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                  <span class="badge badge-admin">${escapeHtml(p.category || '活动')}</span>
                  ${statusBadge}
                  <span style="font-size: 12px; color: #64748b;">
                    发起人: <strong>${escapeHtml(p.creator_name)}</strong> (${escapeHtml(p.creator_college || '社员')}) · ${formatDateTime(p.created_at)}
                  </span>
                </div>
                <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">${escapeHtml(p.title)}</h3>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 8px;">
                  ${escapeHtml(p.description || p.details.slice(0, 140))}
                </p>
              </div>

              <!-- 投票互动区 -->
              <div class="proposal-vote-box">
                <div class="vote-tally-num">${p.vote_count || 0} <span style="font-size: 13px; font-weight: 500; color: #64748b;">票</span></div>
                ${canVote ? `
                  <button class="btn ${p.hasVoted ? 'btn-success' : 'btn-outline'} btn-sm" onclick="toggleProposalVote(${p.id})">
                    ${p.hasVoted ? '✅ 已投支持票' : '👍 为该活动投票'}
                  </button>
                ` : `
                  <button class="btn btn-outline btn-sm" disabled style="opacity: 0.6;" title="成为社员后可投票">
                    🔒 成员专享投票
                  </button>
                `}
              </div>
            </div>

            <div class="proposal-meta-pills">
              <span>📅 拟定时间：<strong>${escapeHtml(p.expected_time || '待定')}</strong></span>
              <span>📍 拟定地点：<strong>${escapeHtml(p.expected_location || '待定')}</strong></span>
              <span>💰 预算估算：<strong>${escapeHtml(p.budget || '待核算')}</strong></span>
              <button class="btn btn-secondary btn-sm" style="margin-left: auto;" onclick="openProposalDetailModal(${p.id})">
                🔍 查看方案细节与决议 &rarr;
              </button>
            </div>

            ${p.status === 'approved_to_hold' && p.admin_decision_notes ? `
              <div class="alert alert-success" style="margin-top: 14px; margin-bottom: 0; font-size: 13.5px;">
                🎯 <strong>官方管理组决议：</strong>${escapeHtml(p.admin_decision_notes)}
                <span style="font-size: 12px; opacity: 0.8; margin-left: 10px;">(审批人: ${escapeHtml(p.decided_admin_name || '管理组')})</span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">加载活动提案失败: ${err.message}</div>`;
  }
}

async function toggleProposalVote(proposalId) {
  try {
    const res = await apiRequest(`/proposals/${proposalId}/vote`, { method: 'POST' });
    if (res.success) {
      showToast(res.message, 'success');
      await loadProposals();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openProposalDetailModal(proposalId) {
  const p = cachedProposals.find(item => item.id == proposalId);
  if (!p) return;

  document.getElementById('pdetail-title').innerText = p.title;

  let statusHtml = '';
  if (p.status === 'approved_to_hold') {
    statusHtml = '<span class="badge badge-member">🎉 管理员已决定举办</span>';
  } else if (p.status === 'rejected') {
    statusHtml = '<span class="badge badge-status-rejected">决议暂不举办</span>';
  } else {
    statusHtml = '<span class="badge badge-super">🗳️ 社内投票中</span>';
  }

  document.getElementById('pdetail-body').innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
      <div>
        <span class="badge badge-admin">${escapeHtml(p.category)}</span>
        ${statusHtml}
      </div>
      <div style="font-size: 13.5px; color: #64748b;">
        当前支持票数：<strong style="color: var(--primary); font-size: 16px;">${p.vote_count || 0}</strong> 票
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; font-size: 13.5px; background: #f8fafc; padding: 14px; border-radius: var(--radius-md);">
      <div><strong>发起社员：</strong>${escapeHtml(p.creator_name)} (${escapeHtml(p.creator_college || '社员')})</div>
      <div><strong>提交时间：</strong>${formatDateTime(p.created_at)}</div>
      <div><strong>拟定时间：</strong>${escapeHtml(p.expected_time || '待定')}</div>
      <div><strong>拟定地点：</strong>${escapeHtml(p.expected_location || '待定')}</div>
      <div><strong>经费预算：</strong>${escapeHtml(p.budget || '待核算')}</div>
    </div>

    ${p.description ? `
      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">活动背景与核心目的：</h4>
        <p style="font-size: 14px; color: #475569; line-height: 1.7;">${escapeHtml(p.description)}</p>
      </div>
    ` : ''}

    <div style="margin-bottom: 20px;">
      <h4 style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">活动要求与具体执行细节：</h4>
      <div style="font-size: 14px; color: #334155; line-height: 1.8; background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; white-space: pre-wrap;">${escapeHtml(p.details)}</div>
    </div>

    ${p.admin_decision_notes ? `
      <div class="alert ${p.status === 'approved_to_hold' ? 'alert-success' : 'alert-warning'}">
        <strong>官方管理员决议与批复意见：</strong><br>
        ${escapeHtml(p.admin_decision_notes)}<br>
        <span style="font-size: 12px; opacity: 0.85;">审批管理员：${escapeHtml(p.decided_admin_name || '管理组')} · 决议时间：${formatDateTime(p.decided_at)}</span>
      </div>
    ` : ''}
  `;

  openModal('modal-proposal-detail');
}

// ==================== Tab 5: 社内交流留言板 (Messages) ====================
async function loadMessages() {
  const container = document.getElementById('messages-list-container');
  const countIndicator = document.getElementById('msg-count-indicator');
  const postBox = document.getElementById('msg-post-box');
  if (!container) return;

  const isMember = ['member', 'admin', 'super_admin'].includes(currentUser.role);
  if (!isMember && postBox) {
    postBox.innerHTML = `
      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: var(--radius-md); padding: 20px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 6px;">🔒</div>
        <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">社内交流专区（社员专享发帖）</div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
          您当前身份为【普通用户】。提交入社申请并通过审核晋升为【社团成员】后，即可畅享留言互动与向管理员提问！
        </p>
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-submit-app')">提交入社申请成为社员</button>
      </div>
    `;
  }

  try {
    const res = await apiRequest('/messages');
    if (res.success && Array.isArray(res.data)) {
      cachedMessages = res.data;
      if (countIndicator) countIndicator.innerText = `共 ${cachedMessages.length} 条互动交流`;

      if (cachedMessages.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; color: #64748b;">
            💬 暂无留言交流，快来留下第一条社内留言吧！
          </div>
        `;
        return;
      }

      container.innerHTML = cachedMessages.map(m => `
        <div class="msg-thread-card">
          <div class="msg-author-row">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                ${escapeHtml((m.user_name || 'U').slice(0, 1))}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; font-size: 15px; color: #0f172a;">${escapeHtml(m.user_name)}</span>
                  ${getRoleBadge(m.user_role)}
                  ${m.is_pinned ? '<span class="badge badge-super" style="font-size:11px;">📌 置顶留言</span>' : ''}
                </div>
                <div style="font-size: 12px; color: #64748b;">${escapeHtml(m.user_college || '社员')} · ${formatDateTime(m.created_at)}</div>
              </div>
            </div>
          </div>

          <div style="font-size: 14.5px; color: #334155; line-height: 1.7; margin-bottom: 10px; white-space: pre-wrap;">${escapeHtml(m.content)}</div>

          ${m.admin_reply ? `
            <div class="msg-admin-reply-box">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #065f46; font-size: 13.5px;">
                  <span>🛡️ 官方管理组答复</span>
                  <span style="font-size: 12px; font-weight: 500; color: #047857;">(${escapeHtml(m.reply_admin_name || '管理员')})</span>
                </div>
                <span style="font-size: 12px; color: #6ee7b7;">${formatDateTime(m.replied_at)}</span>
              </div>
              <div style="font-size: 14px; color: #064e3b; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(m.admin_reply)}</div>
            </div>
          ` : `
            <div style="font-size: 12px; color: #94a3b8; text-align: right;">
              ⏳ 待管理员官方答复
            </div>
          `}
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">加载留言失败: ${err.message}</div>`;
  }
}

async function handlePostMessage(e) {
  e.preventDefault();
  const input = document.getElementById('msg-content-input');
  const content = input.value.trim();
  if (!content) return;

  const btn = document.getElementById('btn-submit-msg');
  btn.disabled = true;
  btn.innerText = '正在发布...';

  try {
    const res = await apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    if (res.success) {
      showToast(res.message, 'success');
      input.value = '';
      await loadMessages();
      renderOverviewPane();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 发布社内留言';
  }
}

// ==================== Tab 6: 社内专属通知 (Notices) ====================
async function loadMemberNotices() {
  const container = document.getElementById('member-notices-container');
  if (!container) return;

  try {
    const res = await apiRequest('/notices');
    if (res.success && Array.isArray(res.data)) {
      const isMemberUnlocked = res.isMemberUnlocked;
      cachedNotices = res.data.filter(n => n.category === 'member');

      if (!isMemberUnlocked) {
        container.innerHTML = `
          <div style="text-align: center; padding: 48px 24px; color: #64748b; background: #ffffff; border-radius: var(--radius-lg); border: 2px dashed #cbd5e1;">
            <div style="font-size: 38px; margin-bottom: 12px;">🔒</div>
            <h3 style="font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">社内专享通知暂未解锁</h3>
            <p style="font-size: 14px; max-width: 480px; margin: 0 auto 16px auto; line-height: 1.6;">
              内部规章制度、例会备忘与工位设备调度指南仅对正式【社团成员】与管理团队开放。提交申请并通过审核后即可自动解锁。
            </p>
            <button class="btn btn-primary btn-sm" onclick="openModal('modal-submit-app')">提交入社申请成为社员</button>
          </div>
        `;
        return;
      }

      if (cachedNotices.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 36px 20px; color: #64748b; background: #ffffff; border-radius: var(--radius-md); border: 1px solid var(--border);">
            暂无社内专享通知公告
          </div>
        `;
        return;
      }

      container.innerHTML = cachedNotices.map(n => `
        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 24px; margin-bottom: 14px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="badge badge-super" style="font-size: 11.5px;">🔒 ${escapeHtml(n.tag || '社内专享')}</span>
            <span style="font-size: 12px; color: #94a3b8;">${formatDateTime(n.created_at)}</span>
          </div>
          <h3 style="font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">${escapeHtml(n.title)}</h3>
          <div style="font-size: 14px; color: #475569; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(n.content)}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">加载通知失败</div>`;
  }
}