const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 1. 获取导航栏可见页面列表 (公开)
router.get('/nav', async (req, res) => {
  try {
    const pages = await query(`
      SELECT id, title, slug, path, is_system, is_nav_visible, sort_order 
      FROM site_pages 
      WHERE is_nav_visible = 1 
      ORDER BY sort_order ASC, id ASC
    `);

    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    console.error('Fetch nav pages error:', error);
    res.status(500).json({ success: false, message: '获取导航菜单失败: ' + error.message });
  }
});

// 2. 获取所有页面列表 (管理后台使用)
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const pages = await query(`
      SELECT * FROM site_pages 
      ORDER BY sort_order ASC, id ASC
    `);

    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    console.error('Fetch all pages error:', error);
    res.status(500).json({ success: false, message: '获取网页列表失败: ' + error.message });
  }
});

// 3. 根据 slug 获取单个页面详情 (公开)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await getOne('SELECT * FROM site_pages WHERE slug = ?', [slug]);

    if (!page) {
      return res.status(404).json({ success: false, message: '页面未找到' });
    }

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error('Get page by slug error:', error);
    res.status(500).json({ success: false, message: '获取页面详情失败: ' + error.message });
  }
});

// 4. 管理员新增自定义网页
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    let { title, slug, seo_description, content, is_nav_visible, sort_order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '页面标题不能为空' });
    }

    // 格式化 slug
    if (!slug || !slug.trim()) {
      slug = 'page_' + Date.now();
    } else {
      slug = slug.trim().toLowerCase().replace(/[^\w-]/g, '-').replace(/^-+|-+$/g, '');
    }

    // 检查 slug 是否冲突
    const existing = await getOne('SELECT id FROM site_pages WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(400).json({ success: false, message: `页面标识 Slug【${slug}】已存在，请换一个英文标识` });
    }

    const path = `/page/${slug}`;
    const navVisible = is_nav_visible === false || is_nav_visible === 'false' || is_nav_visible === 0 ? 0 : 1;
    const sort = parseInt(sort_order, 10) || 10;

    const result = await execute(`
      INSERT INTO site_pages (title, slug, path, is_system, is_nav_visible, sort_order, seo_description, content)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `, [
      title.trim(),
      slug,
      path,
      navVisible,
      sort,
      (seo_description || '').trim(),
      (content || '').trim()
    ]);

    res.status(201).json({
      success: true,
      message: `自定义网页【${title}】创建成功！访问地址：${path}`,
      data: {
        id: result.lastInsertRowid,
        title,
        slug,
        path
      }
    });
  } catch (error) {
    console.error('Create page error:', error);
    res.status(500).json({ success: false, message: '创建网页失败: ' + error.message });
  }
});

// 5. 管理员编辑网页信息与内容
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const pageId = req.params.id;
    const { title, seo_description, content, is_nav_visible, sort_order } = req.body;

    const page = await getOne('SELECT * FROM site_pages WHERE id = ?', [pageId]);
    if (!page) {
      return res.status(404).json({ success: false, message: '页面不存在' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '页面标题不能为空' });
    }

    const navVisible = is_nav_visible === false || is_nav_visible === 'false' || is_nav_visible === 0 ? 0 : 1;
    const sort = parseInt(sort_order, 10) || page.sort_order;

    await execute(`
      UPDATE site_pages 
      SET title = ?, seo_description = ?, content = ?, is_nav_visible = ?, sort_order = ?
      WHERE id = ?
    `, [
      title.trim(),
      (seo_description || '').trim(),
      content !== undefined ? content : page.content,
      navVisible,
      sort,
      pageId
    ]);

    res.json({
      success: true,
      message: `网页【${title}】更新成功！`
    });
  } catch (error) {
    console.error('Update page error:', error);
    res.status(500).json({ success: false, message: '更新网页失败: ' + error.message });
  }
});

// 6. 管理员删除网页 (系统核心页面保护)
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const pageId = req.params.id;
    const page = await getOne('SELECT * FROM site_pages WHERE id = ?', [pageId]);

    if (!page) {
      return res.status(404).json({ success: false, message: '页面不存在' });
    }

    // 系统核心页面不可直接物理删除，但可隐藏导航
    if (page.is_system === 1) {
      return res.status(400).json({
        success: false,
        message: `【${page.title}】属于系统核心内置页面，不允许彻底删除。如需不显示在导航栏，请在编辑中关闭「导航栏显示」！`
      });
    }

    await execute('DELETE FROM site_pages WHERE id = ?', [pageId]);

    res.json({
      success: true,
      message: `已成功删除网页【${page.title}】！`
    });
  } catch (error) {
    console.error('Delete page error:', error);
    res.status(500).json({ success: false, message: '删除网页失败: ' + error.message });
  }
});

module.exports = router;
