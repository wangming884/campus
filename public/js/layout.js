/* =========================================================
   全站通用布局与交互管理器 (Shared Layout & Navigation Manager)
   ========================================================= */

// 获取本地缓存的社团/站点名称
function getStoredSiteName() {
  try {
    return localStorage.getItem('campus_club_name') || '发明创新协会';
  } catch (e) {
    return '发明创新协会';
  }
}

let cachedNavItems = [
  { name: '首页', path: '/' },
  { name: '关于我们', path: '/about' },
  { name: '纳新通道', path: '/recruitment' },
  { name: '通知公告', path: '/notices' },
  { name: '联系方式', path: '/contact' }
];

document.addEventListener('DOMContentLoaded', async () => {
  renderSharedNav();
  renderSharedFooter();
  initGlobalAuthModals();
  loadSharedConfig();

  // 1. 实时握手同步服务端最新用户角色信息 (解决权限提升缓存滞后 Bug)
  if (typeof syncCurrentUser === 'function') {
    try {
      await syncCurrentUser();
    } catch (e) {}
    renderSharedNav();
  }

  // 2. 动态拉取后台配置与新增的网页列表
  await loadDynamicNav();

  // 3. 支持通过 URL 参数或 Hash 自动拉起登录/注册弹窗 (如 /?login=1 或 #login)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === '1' || window.location.hash === '#login') {
      setTimeout(() => openLoginModal(), 120);
    } else if (urlParams.get('register') === '1' || window.location.hash === '#register') {
      setTimeout(() => openRegisterModal(), 120);
    }
  } catch (e) {}
});

// 动态拉取导航栏页面列表
async function loadDynamicNav() {
  try {
    const res = await apiRequest('/pages/nav');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      cachedNavItems = res.data.map(p => ({
        name: p.title,
        path: p.path
      }));
      renderSharedNav();
    }
  } catch (e) {
    // 保留默认导航
  }
}

// 统一渲染顶部导航与移动端抽屉
function renderSharedNav() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const navContainer = document.getElementById('shared-header');
  if (!navContainer) return;

  const navItems = cachedNavItems;
  const user = getCurrentUser();
  const isAdminOrSuper = user && ['admin', 'super_admin'].includes(user.role);

  // 注意：此处仅渲染 header 内部导航元素。
  // #mobile-drawer 必须脱离具有 backdrop-filter 的 header，直接挂载在 document.body 下，
  // 否则在移动端/现代浏览器中，backdrop-filter 会创建包含块 (containing block)，
  // 导致 fixed 抽屉被禁锢在 74px 的 header 容器内，移动端完全无法打开菜单。
  navContainer.innerHTML = `
    <div class="container nav-wrapper">
      <a href="/" class="brand-logo">
        <div class="brand-icon">⚡</div>
        <span id="nav-club-name">${escapeHtml(getStoredSiteName() || '发明创新协会')}</span>
      </a>

      <nav>
        <ul class="nav-menu">
          ${navItems.map(item => `
            <li>
              <a href="${item.path}" class="nav-link ${currentPath === item.path ? 'active' : ''}">
                ${item.name}
              </a>
            </li>
          `).join('')}
        </ul>
      </nav>

      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="nav-actions" id="user-nav-actions">
          ${user ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="/profile" style="display: flex; align-items: center; gap: 8px; text-decoration: none;" title="个人中心">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                  ${escapeHtml(user.name ? user.name.slice(0, 1) : 'U')}
                </div>
                <div class="nav-user-text" style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.25; gap: 3px;">
                  <span style="font-size: 13.5px; font-weight: 700; color: var(--text-main); text-align: center; width: 100%;">${escapeHtml(user.name)}</span>
                  ${getRoleBadge(user.role)}
                </div>
              </a>
              <a href="/profile" class="btn btn-outline btn-sm nav-btn-desktop">个人中心</a>
              ${isAdminOrSuper ? `<a href="/admin" class="btn btn-primary btn-sm nav-btn-desktop">🛡️ 管理后台</a>` : ''}
              <button class="btn btn-outline btn-sm nav-btn-desktop" onclick="logout()" title="安全退出" style="padding: 6px 10px;">🚪</button>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-outline btn-sm" onclick="openLoginModal()" style="font-weight: 600; padding: 6px 14px;">登录</button>
              <button class="btn btn-primary btn-sm" onclick="openRegisterModal()" style="font-weight: 600; padding: 6px 14px;">注册</button>
            </div>
          `}
        </div>

        <button class="mobile-toggle" onclick="toggleMobileDrawer()" title="打开菜单" aria-label="打开导航菜单">☰</button>
      </div>
    </div>
  `;

  renderSharedMobileDrawer();
}

// 独立挂载在 document.body 上的移动端全屏侧滑抽屉
function renderSharedMobileDrawer() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const navItems = cachedNavItems;
  const user = getCurrentUser();
  const isAdminOrSuper = user && ['admin', 'super_admin'].includes(user.role);

  let drawer = document.getElementById('mobile-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'mobile-drawer';
    drawer.id = 'mobile-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.onclick = function(event) {
      if (event.target === this) closeMobileDrawer();
    };
    document.body.appendChild(drawer);
  } else if (drawer.parentElement !== document.body) {
    // 确保抽屉挂载在 body 根节点，脱离 header 的 backdrop-filter 包含块
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = `
    <div class="drawer-content">
      <div class="drawer-header">
        <div style="font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">📱</span>
          <span id="drawer-club-name">${escapeHtml(getStoredSiteName() || '发明创新协会')}</span>
        </div>
        <button class="modal-close" onclick="closeMobileDrawer()" aria-label="关闭导航">&times;</button>
      </div>
      <ul class="drawer-links">
        ${navItems.map(item => `
          <li>
            <a href="${item.path}" class="${currentPath === item.path ? 'active' : ''}" onclick="closeMobileDrawer()">
              ${item.name}
            </a>
          </li>
        `).join('')}
        <li style="margin-top: 18px; border-top: 1px solid var(--border-light); padding-top: 16px;">
          ${user ? `
            <a href="/profile" onclick="closeMobileDrawer()">👤 个人中心 (${escapeHtml(user.name)})</a>
            ${isAdminOrSuper ? `<a href="/admin" style="color: var(--primary);" onclick="closeMobileDrawer()">🛡️ 进入管理后台</a>` : ''}
            <a href="javascript:void(0)" onclick="closeMobileDrawer(); logout();" style="color: var(--danger);">🚪 安全退出</a>
          ` : `
            <div class="drawer-auth-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button class="btn btn-outline" style="width: 100%; justify-content: center; padding: 10px 12px; font-weight: 600;" onclick="closeMobileDrawer(); openLoginModal();">🔑 账号登录</button>
              <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 10px 12px; font-weight: 600;" onclick="closeMobileDrawer(); openRegisterModal();">✨ 快速注册</button>
            </div>
          `}
        </li>
      </ul>
    </div>
  `;
}

function openMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer && drawer.classList.contains('active')) {
    closeMobileDrawer();
  } else {
    openMobileDrawer();
  }
}
window.openMobileDrawer = openMobileDrawer;
window.closeMobileDrawer = closeMobileDrawer;
window.toggleMobileDrawer = toggleMobileDrawer;
// 统一渲染页脚
function renderSharedFooter() {
  const footerContainer = document.getElementById('shared-footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <h4 id="footer-club-name">发明创新协会</h4>
          <p id="footer-club-subtitle">青年科技与创新创业实践平台，凝聚青年智慧，点燃创新火花。深耕实践与前沿科技探索。</p>
          <div style="margin-top: 16px; font-size: 13px; color: #64748b;">
            纳新周期：每年秋季前四周 · 面向大一公开招新
          </div>
        </div>

        <div class="footer-col">
          <h5>联系社团</h5>
          <ul id="footer-contact-list">
            <li>📍 地址：大学生活动中心 302 发明创新协会工坊</li>
            <li>📧 官方邮箱：contact@campus.club</li>
            <li>🐧 招新QQ群：889217643</li>
            <li>📱 微信公众号：Campus_Geek_Club</li>
          </ul>
        </div>

        <div class="footer-col">
          <h5>站点导航</h5>
          <ul>
            <li><a href="/about">📖 关于社团历史与愿景</a></li>
            <li><a href="/recruitment">🚀 2026 纳新申请直通车</a></li>
            <li><a href="/notices">📢 最新通告与学术预告</a></li>
            <li><a href="/contact">📞 联系我们与工位参访</a></li>
            <li><a href="/admin">🛡️ 综合管理后台</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        &copy;  发明创新协会官方网站
      </div>
    </div>
  `;
}

// 注入全站通用的登录与注册模态弹窗
function initGlobalAuthModals() {
  if (document.getElementById('modal-login')) return;

  const modalRoot = document.createElement('div');
  modalRoot.innerHTML = `
    <!-- 登录弹窗 -->
    <div class="modal-overlay" id="modal-login">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="modal-title">账号登录</h3>
          <button class="modal-close" onclick="closeModal('modal-login')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-login" onsubmit="handleGlobalLogin(event)">
            <div class="form-group">
              <label class="form-label">注册邮箱 <span class="required">*</span></label>
              <input type="email" class="form-control" id="login-email" placeholder="例如：yourname@campus.edu" required>
            </div>
            <div class="form-group">
              <label class="form-label">登录密码 <span class="required">*</span></label>
              <input type="password" class="form-control" id="login-password" placeholder="请输入密码" required>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
              ⚠️ 登录后可访问个人中心、纳新通道、社团公告等功能。请确保使用注册时的邮箱与密码登录。
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">立即登录</button>
          </form>
        </div>
        <div class="modal-footer" style="justify-content: center; font-size: 13.5px;">
          还没有账号？<a href="javascript:switchModal('modal-login', 'modal-register')" style="color: var(--primary); font-weight: 600;">点击快速注册</a>
        </div>
      </div>
    </div>

    <!-- 注册弹窗 -->
    <div class="modal-overlay" id="modal-register">
      <div class="modal-container" style="max-width: 560px;">
        <div class="modal-header">
          <h3 class="modal-title">新用户注册 (成为普通用户)</h3>
          <button class="modal-close" onclick="closeModal('modal-register')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info" style="margin-bottom: 16px;">
            💡 注册成功后角色统一为【普通用户】。可在【纳新通道】下载申请表模板并提交，审核通过后即可升级为【社团成员】！
          </div>
          <form id="form-register" onsubmit="handleGlobalRegister(event)">
            <div class="modal-form-grid-2">
              <div class="form-group">
                <label class="form-label">真实姓名 <span class="required">*</span></label>
                <input type="text" class="form-control" id="reg-name" placeholder="真实姓名" required>
              </div>
              <div class="form-group">
                <label class="form-label">QQ号码 <span class="required">*</span></label>
                <input type="text" class="form-control" id="reg-qq" placeholder="QQ号" required>
              </div>
            </div>

            <div class="modal-form-grid-2">
              <div class="form-group">
                <label class="form-label">所在学院 <span class="required">*</span></label>
                <input type="text" class="form-control" id="reg-college" placeholder="如：计算机学院" required>
              </div>
              <div class="form-group">
                <label class="form-label">专业班级 <span class="required">*</span></label>
                <input type="text" class="form-control" id="reg-className" placeholder="如：软件2301" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">电子邮箱 (作为登录账号与邮件通知收件地址) <span class="required">*</span></label>
              <input type="email" class="form-control" id="reg-email" placeholder="常用有效邮箱" required>
            </div>

            <div class="form-group">
              <label class="form-label">邮箱认证码 <span class="required">*</span></label>
              <div style="display: flex; gap: 8px;">
                <input type="text" class="form-control" id="reg-verification-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="6位认证码" required>
                <button type="button" class="btn btn-outline" id="btn-send-verification-code" onclick="sendRegistrationVerificationCode()" style="white-space: nowrap;">获取认证码</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">设置密码 (至少6位) <span class="required">*</span></label>
              <input type="password" class="form-control" id="reg-password" minlength="6" placeholder="6位以上字符" required>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">立即注册</button>
          </form>
        </div>
        <div class="modal-footer" style="justify-content: center; font-size: 13.5px;">
          已有账号？<a href="javascript:switchModal('modal-register', 'modal-login')" style="color: var(--primary); font-weight: 600;">点击直接登录</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalRoot);
}

// 加载全站统一配置
async function loadSharedConfig() {
  try {
    const res = await apiRequest('/portal/config');
    if (res.success && res.data) {
      const cfg = res.data;
      if (cfg.club_name) {
        try { localStorage.setItem('campus_club_name', cfg.club_name); } catch (e) {}
      }
      if (document.getElementById('nav-club-name')) {
        document.getElementById('nav-club-name').innerText = cfg.club_name;
      }
      if (document.getElementById('drawer-club-name')) {
        document.getElementById('drawer-club-name').innerText = cfg.club_name;
      }
      if (document.getElementById('footer-club-name')) {
        document.getElementById('footer-club-name').innerText = cfg.club_name;
      }
      if (cfg.contact) {
        const cList = document.getElementById('footer-contact-list');
        if (cList) {
          cList.innerHTML = `
            <li>📍 地址：${escapeHtml(cfg.contact.location || '大学生活动中心 302 极客创客工坊')}</li>
            <li>📧 官方邮箱：${escapeHtml(cfg.contact.email || 'contact@campus.club')}</li>
            <li>🐧 官方交流QQ群：${escapeHtml(cfg.contact.qqGroup || '889217643')}</li>
            <li>📱 微信公众号：${escapeHtml(cfg.contact.wechat || 'Campus_Geek_Club')}</li>
          `;
        }
      }
    }
  } catch (e) {}
}

// 系统页存在自定义 HTML 时，替换默认页面模板，便于为不同社团快速定制官网。
async function loadSystemPageCMS(slug) {
  try {
    const res = await apiRequest(`/pages/${encodeURIComponent(slug)}`);
    const page = res && res.success ? res.data : null;
    if (!page) return false;
    if (!page.content_html || !page.content_html.trim()) {
      applyPageTemplateConfig(page.template_config || {});
      if (page.title) document.title = page.title;
      const description = document.querySelector('meta[name="description"]');
      if (description && page.seo_description) description.setAttribute('content', page.seo_description);
      return false;
    }

    const override = document.createElement('section');
    override.className = 'section cms-page-override';
    override.innerHTML = `<div class="container">${page.content_html}</div>`;
    const header = document.getElementById('shared-header');
    if (header) header.insertAdjacentElement('afterend', override);
    document.querySelectorAll('.page-banner, body > .section').forEach(element => {
      if (element !== override && !element.classList.contains('cms-page-override')) element.style.display = 'none';
    });
    if (page.title) document.title = page.title;
    const description = document.querySelector('meta[name="description"]');
    if (description && page.seo_description) description.setAttribute('content', page.seo_description);
    return true;
  } catch (error) {
    return false;
  }
}

function applyPageTemplateConfig(config) {
  const template = typeof config === 'string' ? (() => {
    try { return JSON.parse(config || '{}'); } catch (error) { return {}; }
  })() : (config || {});
  window.activePageTemplate = template;
  Object.entries(template).forEach(([field, value]) => {
    if (field.startsWith('show')) {
      document.querySelectorAll(`[data-cms-section="${field}"]`).forEach(element => {
        element.style.display = value === false ? 'none' : '';
      });
      return;
    }
    if (!value) return;
    document.querySelectorAll(`[data-cms-field="${field}"]`).forEach(element => {
      if (field === 'searchPlaceholder' && 'placeholder' in element) {
        element.placeholder = value;
      } else {
        element.innerText = value;
      }
    });
  });
}

function openLoginModal() {
  initGlobalAuthModals();
  closeMobileDrawer();
  openModal('modal-login');
}

function openRegisterModal() {
  initGlobalAuthModals();
  closeMobileDrawer();
  openModal('modal-register');
}
let verificationCodeTimer = null;

async function sendRegistrationVerificationCode() {
  const emailInput = document.getElementById('reg-email');
  const button = document.getElementById('btn-send-verification-code');
  const email = emailInput.value.trim();
  if (!emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }

  button.disabled = true;
  try {
    const res = await apiRequest('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    showToast(res.message, 'success');
    let remaining = 60;
    button.innerText = `${remaining}秒后重发`;
    verificationCodeTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(verificationCodeTimer);
        verificationCodeTimer = null;
        button.disabled = false;
        button.innerText = '获取认证码';
      } else {
        button.innerText = `${remaining}秒后重发`;
      }
    }, 1000);
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

function switchModal(fromId, toId) {
  closeModal(fromId);
  setTimeout(() => openModal(toId), 150);
}

async function handleGlobalLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.success) {
      setCurrentUser(res.user, res.token);
      closeModal('modal-login');
      showToast(res.message, 'success');
      renderSharedNav();
      if (typeof checkRecruitmentUserStatus === 'function') {
        checkRecruitmentUserStatus();
      }
      if (['admin', 'super_admin'].includes(res.user.role)) {
        setTimeout(() => showToast(`欢迎管理团队【${getRoleName(res.user.role)}】登录，可点击右上角管理后台`, 'info', 4000), 700);
      }
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleGlobalRegister(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('reg-name').value,
    qq: document.getElementById('reg-qq').value,
    college: document.getElementById('reg-college').value,
    className: document.getElementById('reg-className').value,
    email: document.getElementById('reg-email').value,
    password: document.getElementById('reg-password').value,
    verificationCode: document.getElementById('reg-verification-code').value
  };

  try {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      setCurrentUser(res.user, res.token);
      closeModal('modal-register');
      showToast(res.message, 'success', 5000);
      renderSharedNav();
      if (typeof checkRecruitmentUserStatus === 'function') {
        checkRecruitmentUserStatus();
      }
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ========== ✨ 全站视效增强：滚动入场动画 + 返回顶部 ==========

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

function initBackToTop() {
  if (document.getElementById('back-to-top')) return;

  const btn = document.createElement('button');
  btn.id = 'back-to-top';
  btn.className = 'back-to-top';
  btn.innerHTML = '⬆';
  btn.title = '返回顶部';
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(btn);

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        btn.classList.toggle('visible', window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initBackToTop();
});