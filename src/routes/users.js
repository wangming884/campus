const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 获取注册人数上限与当前人数
router.get('/registration-limit', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const count = await getOne('SELECT COUNT(*) AS count FROM users');
    let setting = null;

    // 用户数是独立的核心数据。兼容旧云端数据库在初始化配置表失败的情况，
    // 避免配置查询异常把当前用户数也变成无法读取。
    try {
      setting = await getOne('SELECT value FROM system_settings WHERE `key` = ?', ['registration_limit']);
    } catch (settingError) {
      console.warn('Read registration limit setting failed, using default:', settingError.message);
    }

    const limit = Number.parseInt(setting && setting.value, 10);
    res.json({
      success: true,
      data: {
        limit: Number.isFinite(limit) && limit >= 0 ? limit : 1000,
        current: Number(count && count.count) || 0
      }
    });
  } catch (error) {
    console.error('Fetch registration limit error:', error);
    res.status(500).json({ success: false, message: '获取注册人数上限失败: ' + error.message });
  }
});

// 更新注册人数上限
router.put('/registration-limit', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const limit = Number(req.body.limit);
    const count = await getOne('SELECT COUNT(*) AS count FROM users');
    const current = Number(count && count.count) || 0;

    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({ success: false, message: '注册人数上限必须是大于 0 的整数' });
    }
    if (limit < current) {
      return res.status(400).json({
        success: false,
        message: `注册人数上限不能小于当前已注册人数（${current}人）`
      });
    }

    await execute('REPLACE INTO system_settings (`key`, `value`) VALUES (?, ?)', ['registration_limit', String(limit)]);
    res.json({ success: true, message: `注册人数上限已设置为 ${limit} 人`, data: { limit, current } });
  } catch (error) {
    console.error('Update registration limit error:', error);
    res.status(500).json({ success: false, message: '保存注册人数上限失败: ' + error.message });
  }
});

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

// 5. 管理员/超管重置用户密码为统一初始密码 123456
router.post('/:id/reset-password', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 超管不可被重置密码
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ success: false, message: '超级管理员的密码不可通过系统重置' });
    }

    // 权限校验：管理员只能重置 user 和 member 的密码；超管还可以重置 admin 的密码
    if (req.user.role !== 'super_admin') {
      if (targetUser.role === 'admin') {
        return res.status(403).json({ success: false, message: '只有超级管理员有权重置管理员的密码！' });
      }
    }

    // 将密码重置为 123456
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('123456', salt);
    await execute('UPDATE users SET password = ? WHERE id = ?', [hash, targetUserId]);

    const roleNameMap = { user: '普通用户', member: '社团成员', admin: '管理员' };
    res.json({
      success: true,
      message: `已成功将【${targetUser.name}】（${roleNameMap[targetUser.role] || targetUser.role}）的登录密码重置为：123456`
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: '重置密码失败: ' + error.message });
  }
});

// 6. 管理员/超管删除用户账号
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await getOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ success: false, message: '超级管理员账号不可被删除！' });
    }

    if (req.user.role !== 'super_admin' && targetUser.role === 'admin') {
      return res.status(403).json({ success: false, message: '只有超级管理员有权删除管理员账号！' });
    }

    if (parseInt(targetUserId) === parseInt(req.user.id)) {
      return res.status(400).json({ success: false, message: '不能删除自己的账号！' });
    }

    const roleNameMap = { user: '普通用户', member: '社团成员', admin: '管理员' };

    // 先删除关联数据
    await execute('DELETE FROM proposal_votes WHERE user_id = ?', [targetUserId]);
    await execute('DELETE FROM membership_applications WHERE user_id = ?', [targetUserId]);
    await execute('DELETE FROM member_messages WHERE user_id = ?', [targetUserId]);
    await execute('DELETE FROM activity_proposals WHERE user_id = ?', [targetUserId]);
    await execute('DELETE FROM mail_logs WHERE to_email = ?', [targetUser.email]);

    // 最后删除用户本身
    await execute('DELETE FROM users WHERE id = ?', [targetUserId]);

    res.json({
      success: true,
      message: `已成功删除【${targetUser.name}】（${roleNameMap[targetUser.role] || targetUser.role}）的账号及其关联数据`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: '删除用户失败: ' + error.message });
  }
});

module.exports = router;