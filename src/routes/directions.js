const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query, getOne, execute } = require('../db/database');

// 1. 获取所有活跃的发展意向方向（公开接口，供申请表下拉使用）
router.get('/', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, title, sort_order FROM development_directions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get directions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 管理员获取完整方向列表（含非活跃项）
router.get('/manage', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const rows = await query('SELECT * FROM development_directions ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Manage directions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. 管理员新增方向
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { title, sort_order } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '方向标题不可为空' });
    }
    const result = await execute(
      'INSERT INTO development_directions (title, sort_order, is_active) VALUES (?, ?, 1)',
      [title.trim(), sort_order || 0]
    );
    res.json({ success: true, message: '新增发展意向方向成功', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Create direction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. 管理员编辑方向
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { title, sort_order, is_active } = req.body;
    const existing = await getOne('SELECT * FROM development_directions WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '方向不存在' });
    }
    await execute(
      'UPDATE development_directions SET title = COALESCE(?, title), sort_order = COALESCE(?, sort_order), is_active = COALESCE(?, is_active) WHERE id = ?',
      [title || null, sort_order !== undefined ? sort_order : null, is_active !== undefined ? is_active : null, req.params.id]
    );
    res.json({ success: true, message: '发展意向方向更新成功' });
  } catch (error) {
    console.error('Update direction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. 管理员删除方向
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const existing = await getOne('SELECT * FROM development_directions WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: '方向不存在' });
    }
    await execute('DELETE FROM development_directions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '发展意向方向已删除' });
  } catch (error) {
    console.error('Delete direction error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 角色升级申请 (Role Applications) ====================

// 6. 社团成员提交成为管理员的角色升级申请
router.post('/role-applications', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'member') {
      return res.status(403).json({ success: false, message: '只有正式社团成员才能提交角色升级申请' });
    }

    const { target_direction, reason } = req.body;
    if (!target_direction || !target_direction.trim()) {
      return res.status(400).json({ success: false, message: '请选择意向申请发展方向' });
    }

    const existing = await getOne(
      "SELECT * FROM role_applications WHERE user_id = ? AND status = 'pending' AND target_role = 'admin'",
      [user.id]
    );
    if (existing) {
      return res.status(400).json({ success: false, message: '您已有一条待审核的管理员申请，请勿重复提交' });
    }

    const result = await execute(
      'INSERT INTO role_applications (user_id, user_name, user_email, current_role, target_role, target_direction, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.role, 'admin', target_direction.trim(), reason || '']
    );

    res.json({ success: true, message: '管理员申请已成功提交，请留意审核通知！', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Submit role application error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. 获取当前用户的角色升级申请记录
router.get('/role-applications/my', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM role_applications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get my role applications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 8. 管理员获取待审核的角色升级申请
router.get('/role-applications', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM role_applications ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get role applications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. 管理员审核角色升级申请（批准或驳回）
router.put('/role-applications/:id/review', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '审核状态只能为 approved 或 rejected' });
    }

    const app = await getOne('SELECT * FROM role_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).json({ success: false, message: '申请记录不存在' });
    }
    if (app.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该申请已审核，不可重复操作' });
    }

    if (status === 'approved') {
      const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [app.user_id]);
      if (targetUser) {
        if (targetUser.role === 'super_admin') {
          return res.status(403).json({ success: false, message: '不可修改超级管理员的角色' });
        }
        if (targetUser.role === 'admin') {
          await execute(
            "UPDATE role_applications SET status = 'approved', reviewer_id = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?",
            [req.user.id, '该用户已是管理员，无需重复升级。', req.params.id]
          );
          return res.json({ success: true, message: '该用户当前已是管理员' });
        }
        await execute("UPDATE users SET role = 'admin' WHERE id = ?", [app.user_id]);
      }
    }

    await execute(
      "UPDATE role_applications SET status = ?, reviewer_id = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?",
      [status, req.user.id, notes || '', req.params.id]
    );

    const msg = status === 'approved'
      ? `已批准 ${app.user_name} 的晋升管理员申请！`
      : `已驳回 ${app.user_name} 的晋升管理员申请。`;

    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Review role application error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;