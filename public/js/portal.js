/* =========================================================
   社团官网首页专有动态渲染逻辑 (Portal Homepage Logic)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  loadSystemPageCMS('home');
  loadPortalConfig();
  loadHomepageNotices();
  loadActiveTemplate();
});

// 加载官网首页配置
async function loadPortalConfig() {
  try {
    const res = await apiRequest('/portal/config');
    if (res.success && res.data) {
      const cfg = res.data;

      // 更新首屏 Hero
      if (cfg.hero_badge && document.getElementById('hero-badge-text')) {
        document.getElementById('hero-badge-text').innerText = cfg.hero_badge;
      }
      if (cfg.hero_title && document.getElementById('hero-title-text')) {
        document.getElementById('hero-title-text').innerHTML = escapeHtml(cfg.hero_title).replace(/\n/g, '<br>');
      }
      if (cfg.hero_subtitle && document.getElementById('hero-subtitle-text')) {
        document.getElementById('hero-subtitle-text').innerText = cfg.hero_subtitle;
      }

      // 更新关于我们概览
      if (cfg.about_title && document.getElementById('about-title-text')) {
        document.getElementById('about-title-text').innerText = cfg.about_title;
      }
      if (cfg.about_content && document.getElementById('about-content-text')) {
        document.getElementById('about-content-text').innerText = cfg.about_content;
      }

      // 渲染统计指标卡片
      renderStats(cfg.stats);
    }
  } catch (error) {
    console.error('加载官网配置失败:', error);
  }
}

// 渲染核心数据卡片
function renderStats(stats) {
  const container = document.getElementById('portal-stats-grid');
  if (!container || !Array.isArray(stats)) return;

  const iconMap = {
    users: '👥',
    calendar: '📅',
    award: '🏆',
    layers: '🏛️',
    code: '💻',
    star: '⭐'
  };

  container.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${iconMap[s.icon] || '✨'}</div>
      <div class="stat-info">
        <div class="stat-number">${escapeHtml(s.value || '0')} <span style="font-size: 14px; font-weight: normal; color: var(--text-muted);">${escapeHtml(s.unit || '')}</span></div>
        <div class="stat-label">${escapeHtml(s.label || '')}</div>
      </div>
    </div>
  `).join('');
}

// 首页精选前 3 条通知
async function loadHomepageNotices() {
  const listContainer = document.getElementById('portal-notices-list');
  if (!listContainer) return;

  try {
    const res = await apiRequest('/notices');
    if (res.success && Array.isArray(res.data)) {
      if (res.data.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">暂无已发布的公告</div>`;
        return;
      }

      // 取最新前 3 条
      const topNotices = res.data.slice(0, 3);
      listContainer.innerHTML = topNotices.map(n => `
        <a href="/notices" class="notice-item">
          <div>
            <div class="notice-meta">
              <span class="badge ${n.category === 'member' ? 'badge-super' : 'badge-admin'}">${escapeHtml(n.tag || '通知')}</span>
              ${n.category === 'member' ? '<span class="badge badge-super" style="font-size:11px;">🔒 社内专享</span>' : ''}
              <span class="notice-date">${formatDateTime(n.created_at)}</span>
            </div>
            <div class="notice-title">${escapeHtml(n.title)}</div>
          </div>
          <div style="color: var(--primary); font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
            阅读详情 &rarr;
          </div>
        </a>
      `).join('');
    }
  } catch (error) {
    console.error('加载通知列表失败:', error);
  }
}

// 加载当前生效的申请表模板信息
async function loadActiveTemplate() {
  try {
    const res = await apiRequest('/applications/template/active');
    if (res.success && res.data) {
      const tip = document.getElementById('cta-template-info');
      if (tip) {
        tip.innerText = `官方当前提供下载：《${res.data.title}》（大小: ${formatFileSize(res.data.size)}）。下载并填写后，即可前往纳新通道在线投递。`;
      }
    }
  } catch (error) {}
}
