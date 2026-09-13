const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 1. 获取用户列表 (管理员和超级管理员可查看)
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { role, keyword } = req.query;
    let sql = 'SELECT id, name, email, college, className, qq, role, created_at FROM users WHERE 1=1';
    const params = [];

    if (role && role !== 'all') {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR college LIKE ? OR className LIKE ? OR email LIKE ? OR qq LIKE ?)';
      const k = `%${keyword}%`;
      params.push(k, k, k, k, k);
    }

    sql += ' ORDER BY id ASC';

    const users = await query(sql, params);
    res.json({
      success: true,
      data: users,
      currentUserRole: req.user.role
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败: ' + error.message });
  }
});

// 2. 将普通用户升级为社团成员 (管理员和超级管理员均有权限)
router.post('/:id/promote-member', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (targetUser.role === 'member') {
      return res.json({ success: true, message: `该用户【${targetUser.name}】已是社团成员，无需重复操作` });
    }

    if (targetUser.role === 'admin' || targetUser.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: `该用户当前已是【${targetUser.role === 'super_admin' ? '超级管理员' : '管理员'}】，无需升级为成员`
      });
    }

    await execute("UPDATE users SET role = 'member' WHERE id = ?", [targetUserId]);

    res.json({
      success: true,
      message: `已成功将【${targetUser.name}】提升为【社团成员】！`,
      user: { id: targetUser.id, name: targetUser.name, role: 'member' }
    });
  } catch (error) {
    console.error('Promote member error:', error);
    res.status(500).json({ success: false, message: '操作失败: ' + error.message });
  }
});

// 3. 提升为管理员 (仅【超级管理员】独享权限，支持将社员或直接将普通用户任命为管理员)
router.post('/:id/promote-admin', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (targetUser.role === 'super_admin') {
      return res.status(400).json({ success: false, message: '该用户已经是系统超级管理员' });
    }

    if (targetUser.role === 'admin') {
      return res.json({ success: true, message: `该用户【${targetUser.name}】已是管理员职务` });
    }

    await execute("UPDATE users SET role = 'admin' WHERE id = ?", [targetUserId]);

    res.json({
      success: true,
      message: `👑【超级管理员授权】已成功将【${targetUser.name}】提拔任命为【管理员】！`,
      user: { id: targetUser.id, name: targetUser.name, role: 'admin' }
    });
  } catch (error) {
    console.error('Promote admin error:', error);
    res.status(500).json({ success: false, message: '提拔管理员失败: ' + error.message });
  }
});

// 3.1 统一角色变更接口 (超级管理员拥有任意调整权；管理员仅限在 user 与 member 之间调整)
router.put('/:id/role', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;

    if (!['user', 'member', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的目标角色设定' });
    }

    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 严禁修改超级管理员的角色
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ success: false, message: '超级管理员全局唯一最高权限，不可更改其角色！' });
    }

    // 普通管理员权限校验：普通管理员绝无权提拔或降级管理员，只能管理 user 和 member
    if (req.user.role !== 'super_admin') {
      if (role === 'admin' || targetUser.role === 'admin') {
        return res.status(403).json({ success: false, message: '只有超级管理员有权调整管理员职务！' });
      }
    }

    // 若目标角色与当前角色一致，直接提示无需重复变更
    const roleNameMap = { user: '普通用户', member: '社团成员', admin: '管理员' };
    if (targetUser.role === role) {
      return res.json({
        success: true,
        message: `用户【${targetUser.name}】当前已经是【${roleNameMap[role]}】，无需重复变更`
      });
    }

    await execute('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId]);

    res.json({
      success: true,
      message: `已成功将【${targetUser.name}】的角色变更为【${roleNameMap[role]}】！`,
      user: { id: targetUser.id, name: targetUser.name, role }
    });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ success: false, message: '变更角色失败: ' + error.message });
  }
});

// 4. 降级或撤职操作
router.post('/:id/demote', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { to_role } = req.body;
    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 绝对禁止对超级管理员进行降级
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ success: false, message: '系统超级管理员拥有全局唯一最高权限，不可被降级！' });
    }

    // 若目标是管理员：只有超级管理员能将其撤职为成员
    if (targetUser.role === 'admin') {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: '只有超级管理员有权撤销管理员职务！' });
      }
      const newRole = to_role === 'user' ? 'user' : 'member';
      await execute('UPDATE users SET role = ? WHERE id = ?', [newRole, targetUserId]);
      return res.json({
        success: true,
        message: `已将管理员【${targetUser.name}】调整为【${newRole === 'member' ? '社团成员' : '普通用户'}】`
      });
    }

    // 若目标是社团成员：管理员和超管均可将其调整回普通用户
    if (targetUser.role === 'member') {
      await execute("UPDATE users SET role = 'user' WHERE id = ?", [targetUserId]);
      return res.json({
        success: true,
        message: `已将社团成员【${targetUser.name}】变更回【普通用户】`
      });
    }

    res.status(400).json({ success: false, message: '目标用户已经是普通用户，无需降级' });
  } catch (error) {
    console.error('Demote user error:', error);
    res.status(500).json({ success: false, message: '操作失败: ' + error.message });
  }
});

module.exports = router;
