const fs = require('fs');
const path = require('path');
const { getOne, query, clubFilesDir } = require('../db/database');

const publicDir = path.join(__dirname, '../../public');

// 内存缓存，避免每次请求重复读取磁盘与数据库
let cachedTemplates = new Map();
let cachedPortalConfig = null;
let cachedPortalConfigTime = 0;
let cachedNavPages = null;
let cachedNavPagesTime = 0;
let cachedPagesMap = new Map();
let cachedClubDoc = null;
let cachedClubDocTime = 0;
let cachedActiveTemplate = null;
let cachedActiveTemplateTime = 0;

const CACHE_TTL = 30000; // 30秒兜底TTL，管理后台修改时会显式触发 invalidateCache()

function invalidateCache() {
  cachedTemplates.clear();
  cachedPortalConfig = null;
  cachedPortalConfigTime = 0;
  cachedNavPages = null;
  cachedNavPagesTime = 0;
  cachedPagesMap.clear();
  cachedClubDoc = null;
  cachedClubDocTime = 0;
  cachedActiveTemplate = null;
  cachedActiveTemplateTime = 0;
}

function getTemplate(filename) {
  if (process.env.NODE_ENV === 'production' && cachedTemplates.has(filename)) {
    return cachedTemplates.get(filename);
  }
  const filePath = path.join(publicDir, filename);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  if (process.env.NODE_ENV === 'production') {
    cachedTemplates.set(filename, content);
  }
  return content;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJsonParse(val, fallback) {
  if (typeof val === 'object' && val !== null) return val;
  try {
    return JSON.parse(val || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

async function getPortalConfig() {
  const now = Date.now();
  if (cachedPortalConfig && (now - cachedPortalConfigTime < CACHE_TTL)) {
    return cachedPortalConfig;
  }
  try {
    const raw = await getOne('SELECT * FROM portal_config WHERE id = 1');
    if (!raw) return null;
    const parsed = {
      ...raw,
      stats: safeJsonParse(raw.stats_json, []),
      departments: safeJsonParse(raw.departments_json, []),
      contact: safeJsonParse(raw.contact_json, {})
    };
    cachedPortalConfig = parsed;
    cachedPortalConfigTime = now;
    return parsed;
  } catch (e) {
    console.error('[PageRenderer] 获取 portal_config 失败:', e.message);
    return null;
  }
}

async function getNavPages() {
  const now = Date.now();
  if (cachedNavPages && (now - cachedNavPagesTime < CACHE_TTL)) {
    return cachedNavPages;
  }
  try {
    const pages = await query(`
      SELECT id, title, slug, path, is_system, is_nav_visible, sort_order 
      FROM site_pages 
      WHERE is_nav_visible = 1 
      ORDER BY sort_order ASC, id ASC
    `);
    cachedNavPages = pages || [];
    cachedNavPagesTime = now;
    return cachedNavPages;
  } catch (e) {
    return [];
  }
}

async function getPageBySlug(slug) {
  const now = Date.now();
  const cached = cachedPagesMap.get(slug);
  if (cached && (now - cached.time < CACHE_TTL)) {
    return cached.data;
  }
  try {
    const page = await getOne('SELECT * FROM site_pages WHERE slug = ?', [slug]);
    if (!page) return null;
    page.template_config = safeJsonParse(page.template_config, {});
    cachedPagesMap.set(slug, { data: page, time: now });
    return page;
  } catch (e) {
    return null;
  }
}

async function getClubDocumentInfo() {
  const now = Date.now();
  if (cachedClubDoc !== null && (now - cachedClubDocTime < CACHE_TTL)) {
    return cachedClubDoc;
  }
  try {
    const doc = await getOne('SELECT id, title, filename, mime_type, size, updated_at FROM club_documents WHERE id = 1');
    cachedClubDoc = doc || null;
    cachedClubDocTime = now;
    return cachedClubDoc;
  } catch (e) {
    return null;
  }
}

async function getActiveTemplateInfo() {
  const now = Date.now();
  if (cachedActiveTemplate !== null && (now - cachedActiveTemplateTime < CACHE_TTL)) {
    return cachedActiveTemplate;
  }
  try {
    const tpl = await getOne('SELECT id, title, filename, size, created_at FROM application_templates WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    cachedActiveTemplate = tpl || null;
    cachedActiveTemplateTime = now;
    return cachedActiveTemplate;
  } catch (e) {
    return null;
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  } catch (e) {
    return String(isoString);
  }
}

function replaceElementInnerById(html, id, newInnerHtml) {
  const regex = new RegExp(`(<([a-zA-Z0-9]+)[^>]*\\bid=["']${id}["'][^>]*>)[\\s\\S]*?(<\\/\\2>)`, 'i');
  return html.replace(regex, `$1${newInnerHtml}$3`);
}

function setSectionDisplay(html, sectionName, isVisible) {
  const styleDisplayNone = 'display: none;';
  const regexWithStyle = new RegExp(`(<([a-zA-Z0-9]+)[^>]*\\bdata-cms-section=["']${sectionName}["'][^>]*)style=["']([^"']*)["']([^>]*>)`, 'gi');
  if (!isVisible) {
    if (regexWithStyle.test(html)) {
      return html.replace(regexWithStyle, (match, p1, tag, style, p4) => {
        const cleanedStyle = style.replace(/display\s*:\s*none;?/gi, '').trim();
        return `${p1}style="${cleanedStyle ? cleanedStyle + '; ' : ''}${styleDisplayNone}"${p4}`;
      });
    } else {
      const noStyleRegex = new RegExp(`(<([a-zA-Z0-9]+)[^>]*\\bdata-cms-section=["']${sectionName}["'])([^>]*>)`, 'gi');
      return html.replace(noStyleRegex, `$1 style="${styleDisplayNone}"$3`);
    }
  } else {
    return html.replace(regexWithStyle, (match, p1, tag, style, p4) => {
      const cleanedStyle = style.replace(/display\s*:\s*none;?/gi, '').trim();
      return cleanedStyle ? `${p1}style="${cleanedStyle}"${p4}` : `${p1}${p4}`;
    });
  }
}

function replaceCmsField(html, fieldName, newText) {
  const regex = new RegExp(`(<([a-zA-Z0-9]+)[^>]*\\bdata-cms-field=["']${fieldName}["'][^>]*>)[\\s\\S]*?(<\\/\\2>)`, 'gi');
  return html.replace(regex, `$1${escapeHtml(newText)}$3`);
}

/**
 * 核心页面直出渲染方法
 * @param {string} pageType - 'index' | 'about' | 'recruitment' | 'notices' | 'contact' | 'custom_page'
 * @param {string} [slug] - 用于查询 site_pages 的标识
 */
async function renderPageHtml(pageType, slug = '') {
  let templateFile = `${pageType}.html`;
  if (pageType === 'index') templateFile = 'index.html';
  if (pageType === 'custom_page') templateFile = 'custom_page.html';

  let html = getTemplate(templateFile);
  if (!html) return null;

  // 1. 获取全局配置与页面 CMS 配置
  const [portalConfig, navPages, pageCMS, clubDoc, activeTemplate] = await Promise.all([
    getPortalConfig(),
    getNavPages(),
    slug ? getPageBySlug(slug) : null,
    pageType === 'about' ? getClubDocumentInfo() : Promise.resolve(null),
    pageType === 'recruitment' ? getActiveTemplateInfo() : Promise.resolve(null)
  ]);

  const templateConfig = pageCMS?.template_config || {};

  // 2. 全局通用替换：社团名称、导航与页脚
  if (portalConfig?.club_name) {
    html = replaceElementInnerById(html, 'nav-club-name', escapeHtml(portalConfig.club_name));
    html = replaceElementInnerById(html, 'drawer-club-name', escapeHtml(portalConfig.club_name));
    html = replaceElementInnerById(html, 'footer-club-name', escapeHtml(portalConfig.club_name));
  }

  // 3. 通用 SEO 与标题
  if (pageCMS?.title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageCMS.title)} - ${escapeHtml(portalConfig?.club_name || '高校学生社团')}</title>`);
  }
  if (pageCMS?.seo_description) {
    html = html.replace(/(<meta\s+name=["']description["']\s+content=["'])[^"']*["']/i, `$1${escapeHtml(pageCMS.seo_description)}"`);
  }

  // 4. 处理 data-cms-section 显隐逻辑
  if (typeof templateConfig === 'object') {
    for (const [key, value] of Object.entries(templateConfig)) {
      if (key.startsWith('show')) {
        html = setSectionDisplay(html, key, value !== false);
      } else if (value && typeof value === 'string' && value.trim()) {
        html = replaceCmsField(html, key, value);
      }
    }
  }

  // 5. 页面特定数据注入与直出渲染
  if (pageType === 'about') {
    const aboutTitle = templateConfig.introTitle || portalConfig?.about_title;
    if (aboutTitle) {
      html = replaceElementInnerById(html, 'about-page-title', escapeHtml(aboutTitle));
    }
    const aboutContent = templateConfig.introContent || portalConfig?.about_content;
    if (aboutContent) {
      html = replaceElementInnerById(html, 'about-page-content', escapeHtml(aboutContent));
    }
    if (clubDoc) {
      const meta = `${clubDoc.title || clubDoc.filename} · ${formatFileSize(clubDoc.size)}`;
      html = html.replace(/id=["']about-document-download["']\s+style=["'][^"']*display:\s*none;?[^"']*["']/i, 'id="about-document-download" style="display: flex; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-light);"');
      html = replaceElementInnerById(html, 'about-document-download-meta', escapeHtml(meta));
    }
  } else if (pageType === 'recruitment') {
    if (activeTemplate) {
      html = replaceElementInnerById(html, 'rec-template-title', escapeHtml(activeTemplate.title));
      html = replaceElementInnerById(html, 'rec-template-meta', escapeHtml(`存储文件名: ${activeTemplate.filename} · 大小: ${formatFileSize(activeTemplate.size)} · 格式: Word/PDF`));
    }
  } else if (pageType === 'index') {
    if (portalConfig?.hero_badge) {
      html = replaceElementInnerById(html, 'hero-badge-text', escapeHtml(portalConfig.hero_badge));
    }
    if (portalConfig?.hero_title) {
      html = replaceElementInnerById(html, 'hero-title-text', escapeHtml(portalConfig.hero_title).replace(/\n/g, '<br>'));
    }
    if (portalConfig?.hero_subtitle !== undefined) {
      html = replaceElementInnerById(html, 'hero-subtitle-text', escapeHtml(portalConfig.hero_subtitle));
    }
    if (portalConfig?.about_title) {
      html = replaceElementInnerById(html, 'about-title-text', escapeHtml(portalConfig.about_title));
    }
    if (portalConfig?.about_content) {
      html = replaceElementInnerById(html, 'about-content-text', escapeHtml(portalConfig.about_content));
    }
    if (Array.isArray(portalConfig?.stats) && portalConfig.stats.length > 0) {
      const iconMap = {
        users: '👥',
        calendar: '📅',
        award: '🏆',
        layers: '🏛️',
        code: '💻',
        star: '⭐'
      };
      const statsHtml = portalConfig.stats.map(s => `
        <div class="stat-card">
          <div class="stat-icon">${iconMap[s.icon] || '✨'}</div>
          <div class="stat-info">
            <div class="stat-number">${escapeHtml(s.value || '0')} <span style="font-size: 14px; font-weight: normal; color: var(--text-muted);">${escapeHtml(s.unit || '')}</span></div>
            <div class="stat-label">${escapeHtml(s.label || '')}</div>
          </div>
        </div>
      `).join('');
      html = replaceElementInnerById(html, 'portal-stats-grid', statsHtml);
    }
  } else if (pageType === 'contact') {
    if (portalConfig?.contact) {
      const c = portalConfig.contact;
      if (c.location) html = replaceElementInnerById(html, 'cnt-location', escapeHtml(c.location));
      if (c.email) html = replaceElementInnerById(html, 'cnt-email', escapeHtml(c.email));
      if (c.qqGroup) html = replaceElementInnerById(html, 'cnt-qq', escapeHtml(c.qqGroup));
      if (c.wechat) html = replaceElementInnerById(html, 'cnt-wechat', escapeHtml(c.wechat));
    }
  } else if (pageType === 'custom_page') {
    if (pageCMS) {
      html = replaceElementInnerById(html, 'custom-page-title', escapeHtml(pageCMS.title));
      html = replaceElementInnerById(html, 'custom-page-desc', escapeHtml(pageCMS.seo_description || '社团专属空间'));
      html = replaceElementInnerById(html, 'custom-page-date', `🕒 最后更新：${formatDateTime(pageCMS.updated_at || pageCMS.created_at)}`);
      html = replaceElementInnerById(html, 'custom-page-path', `🔗 路由：${escapeHtml(pageCMS.path)}`);
      if (pageCMS.content) {
        let bodyHtml = pageCMS.content.includes('<') && pageCMS.content.includes('>')
          ? pageCMS.content
          : `<div style="white-space: pre-wrap;">${escapeHtml(pageCMS.content)}</div>`;
        html = replaceElementInnerById(html, 'custom-content-body', bodyHtml);
      }
    }
  }

  // 6. 处理自定义 content_html 页面覆盖（用于系统页的自定义扩展）
  if (pageCMS?.content_html && pageCMS.content_html.trim()) {
    const overrideSection = `<section class="section cms-page-override"><div class="container">${pageCMS.content_html}</div></section>`;
    html = html.replace(/(<header\s+id=["']shared-header["'][\s\S]*?<\/header>)/i, `$1\n${overrideSection}`);
    html = html.replace(/(<div\s+class=["'][^"']*page-banner[^"']*["'])/gi, '$1 style="display: none;"');
    html = html.replace(/(<section\s+(?!class=["'][^"']*cms-page-override)[^>]*class=["'][^"']*section[^"']*["'])/gi, '$1 style="display: none;"');
  }

  // 7. 在 <head> 注入全局水合状态对象 window.__INITIAL_DATA__
  const initialData = {
    portalConfig,
    navPages,
    pageCMS,
    clubDocument: clubDoc,
    activeTemplate
  };
  const safeDataJson = JSON.stringify(initialData).replace(/</g, '\\u003c');
  const hydrationScript = `
  <script id="__PORTAL_INITIAL_DATA__">
    window.__INITIAL_DATA__ = ${safeDataJson};
  </script>
</head>`;

  html = html.replace(/<\/head>/i, hydrationScript);

  return html;
}

module.exports = {
  renderPageHtml,
  invalidateCache
};
