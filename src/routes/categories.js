const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query, getOne, execute } = require('../db/database');

// 1. 获取所有活跃的活动类别（公开接口，供下拉选择使用）
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, title, sort_order FROM activity_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 管理员获取完整类别列表（含非活跃项）
router.get('/manage', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const rows = await query('SELECT * FROM activity_categories ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Manage categories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 管理员新增类别
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { title, sort_order } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '类别标题不可为空' });
    }
    const result = await execute(
      'INSERT INTO activity_categories (title, sort_order, is_active) VALUES (?, ?, 1)',
      [title.trim(), sort_order || 0]
    );
    res.json({ success: true, message: '新增活动类别成功', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. 管理员编辑类别
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { title, sort_order, is_active } = req.body;
    const existing = await getOne('SELECT * FROM activity_categories WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '类别不存在' });
    }
    await execute(
      'UPDATE activity_categories SET title = COALESCE(?, title), sort_order = COALESCE(?, sort_order), is_active = COALESCE(?, is_active) WHERE id = ?',
      [title || null, sort_order !== undefined ? sort_order : null, is_active !== undefined ? is_active : null, req.params.id]
    );
    res.json({ success: true, message: '活动类别更新成功' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. 管理员删除类别
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const existing = await getOne('SELECT * FROM activity_categories WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '类别不存在' });
    }
    await execute('DELETE FROM activity_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '活动类别已删除' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;