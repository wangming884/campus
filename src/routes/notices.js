const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');

// 获取通知列表 (公开 + 依据角色过滤成员专享通知 + 关键词搜索)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const isMemberOrAbove = req.user && ['member', 'admin', 'super_admin'].includes(req.user.role);
    const { keyword, category } = req.query;

    let sql = 'SELECT * FROM notices WHERE 1=1';
    const params = [];

    if (!isMemberOrAbove) {
      // 访客或普通用户仅能查看公开通知
      sql += " AND category = 'public'";
    } else if (category && category !== 'all') {
      sql += " AND category = ?";
      params.push(category);
    }

    if (keyword) {
      sql += " AND (title LIKE ? OR content LIKE ? OR tag LIKE ?)";
      const k = `%${keyword}%`;
      params.push(k, k, k);
    }

    sql += ' ORDER BY id DESC';

    const notices = await query(sql, params);
    res.json({
      success: true,
      data: notices,
      isMemberUnlocked: Boolean(isMemberOrAbove)
    });
  } catch (error) {
    console.error('Fetch notices error:', error);
    res.status(500).json({ success: false, message: '获取通知公告失败: ' + error.message });
  }
});

// 查看单条通知详情并递增浏览量
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const isMemberOrAbove = req.user && ['member', 'admin', 'super_admin'].includes(req.user.role);
    const notice = await getOne('SELECT * FROM notices WHERE id = ?', [req.params.id]);

    if (!notice) {
      return res.status(404).json({ success: false, message: '通知不存在' });
    }

    if (notice.category === 'member' && !isMemberOrAbove) {
      return res.status(403).json({ success: false, message: '该通知属于社团成员专享，请审核通过后查看' });
    }

    // 递增浏览次数
    await execute('UPDATE notices SET views = views + 1 WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      data: { ...notice, views: notice.views + 1 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取通知详情失败' });
  }
});

// 管理员发布新通知
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { title, content, category, tag } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '请填写通知标题与内容' });
    }

    const validCategory = category === 'member' ? 'member' : 'public';
    const validTag = tag ? tag.trim() : (validCategory === 'member' ? '社内专享' : '社团通知');

    const result = await execute(`
      INSERT INTO notices (title, content, category, tag, author_id, author_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title.trim(), content.trim(), validCategory, validTag, req.user.id, req.user.name]);

    res.status(201).json({
      success: true,
      message: '通知公告发布成功！',
      data: { id: result.lastInsertRowid, title }
    });
  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({ success: false, message: '发布通知失败: ' + error.message });
  }
});

// 管理员删除通知
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const noticeId = req.params.id;
    await execute('DELETE FROM notices WHERE id = ?', [noticeId]);
    res.json({ success: true, message: '通知已成功删除' });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ success: false, message: '删除通知失败: ' + error.message });
  }
});

module.exports = router;
