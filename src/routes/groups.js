const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * 辅助：确保管理员拥有至少一个其作为组长的默认小组
 */
async function ensureAdminGroup(user) {
  let group = await getOne('SELECT * FROM club_groups WHERE leader_id = ? LIMIT 1', [user.id]);
  if (!group) {
    const defaultName = `${user.name}的小组`;
    const defaultDesc = `由组长 ${user.name} 带领的社团分组团队`;
    const result = await execute(
      'INSERT INTO club_groups (name, leader_id, description) VALUES (?, ?, ?)',
      [defaultName, user.id, defaultDesc]
    );
    const newId = result.insertId || result.lastInsertRowid;
    group = await getOne('SELECT * FROM club_groups WHERE id = ?', [newId]);
  }
  return group;
}

// 1. 获取当前用户所属小组或当前管理员所带领的小组
router.get('/my-group', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const isAdmin = ['admin', 'super_admin'].includes(user.role);

    // 管理员优先作为组长展示自己带领的小组
    if (isAdmin) {
      let group = null;
      if (req.query.groupId && req.user.role === 'super_admin') {
        group = await getOne(`
          SELECT g.*, u.name AS leader_name, u.email AS leader_email, u.qq AS leader_qq
          FROM club_groups g
          JOIN users u ON g.leader_id = u.id
          WHERE g.id = ?
        `, [req.query.groupId]);
      }
      if (!group) {
        group = await ensureAdminGroup(user);
        group = {
          ...group,
          leader_name: user.name,
          leader_email: user.email,
          leader_qq: user.qq
        };
      }
      const members = await query(`
        SELECT u.id, u.name, u.email, u.college, u.className, u.qq, u.role, cgm.joined_at
        FROM club_group_members cgm
        JOIN users u ON cgm.user_id = u.id
        WHERE cgm.group_id = ?
        ORDER BY cgm.joined_at DESC
      `, [group.id]);

      return res.json({
        success: true,
        isLeader: true,
        group,
        members
      });
    }

    // 普通成员/学生用户：查找自己所在的团队
    const memberRecord = await getOne(`
      SELECT g.*, u.name AS leader_name, u.email AS leader_email, u.qq AS leader_qq
      FROM club_group_members cgm
      JOIN club_groups g ON cgm.group_id = g.id
      JOIN users u ON g.leader_id = u.id
      WHERE cgm.user_id = ?
      LIMIT 1
    `, [user.id]);

    if (!memberRecord) {
      return res.json({
        success: true,
        isLeader: false,
        group: null,
        members: [],
        message: '暂未分配至任何社团小组'
      });
    }

    const fellowMembers = await query(`
      SELECT u.id, u.name, u.college, u.className, u.role, cgm.joined_at
      FROM club_group_members cgm
      JOIN users u ON cgm.user_id = u.id
      WHERE cgm.group_id = ?
      ORDER BY cgm.joined_at ASC
    `, [memberRecord.id]);

    return res.json({
      success: true,
      isLeader: false,
      group: memberRecord,
      members: fellowMembers
    });
  } catch (error) {
    console.error('Fetch my group error:', error);
    res.status(500).json({ success: false, message: '获取小组信息失败: ' + error.message });
  }
});

// 2. 更新小组基本信息 (组名、简介)
router.put('/my-group', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { name, description, groupId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '小组名称不能为空' });
    }

    let targetGroup;
    if (groupId && req.user.role === 'super_admin') {
      targetGroup = await getOne('SELECT * FROM club_groups WHERE id = ?', [groupId]);
    } else {
      targetGroup = await ensureAdminGroup(req.user);
    }

    if (!targetGroup) {
      return res.status(404).json({ success: false, message: '未找到指定小组' });
    }

    await execute(
      'UPDATE club_groups SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description ? description.trim() : '', targetGroup.id]
    );

    const updated = await getOne('SELECT * FROM club_groups WHERE id = ?', [targetGroup.id]);
    res.json({
      success: true,
      message: '小组信息已成功更新',
      data: updated
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ success: false, message: '更新小组信息失败: ' + error.message });
  }
});

// 3. 获取候选组员列表 (管理员选择组员时用)
router.get('/candidates', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { keyword, filter, groupId } = req.query;
    let targetGroup;
    if (groupId && req.user.role === 'super_admin') {
      targetGroup = await getOne('SELECT * FROM club_groups WHERE id = ?', [groupId]);
    } else {
      targetGroup = await ensureAdminGroup(req.user);
    }

    let sql = `
      SELECT u.id, u.name, u.email, u.college, u.className, u.qq, u.role,
             cgm.group_id AS current_group_id,
             g.name AS current_group_name,
             g.leader_id AS current_group_leader_id
      FROM users u
      LEFT JOIN club_group_members cgm ON u.id = cgm.user_id
      LEFT JOIN club_groups g ON cgm.group_id = g.id
      WHERE u.id != ?
    `;
    const params = [req.user.id];

    if (keyword && keyword.trim()) {
      const k = `%${keyword.trim()}%`;
      sql += ' AND (u.name LIKE ? OR u.college LIKE ? OR u.className LIKE ? OR u.email LIKE ? OR u.qq LIKE ?)';
      params.push(k, k, k, k, k);
    }

    if (filter === 'unassigned') {
      sql += ' AND cgm.group_id IS NULL';
    } else if (filter === 'in_my_group' && targetGroup) {
      sql += ' AND cgm.group_id = ?';
      params.push(targetGroup.id);
    }

    sql += ' ORDER BY (CASE WHEN cgm.group_id = ? THEN 1 ELSE 0 END) DESC, u.role DESC, u.id ASC';
    params.push(targetGroup ? targetGroup.id : 0);

    const candidates = await query(sql, params);
    const enriched = candidates.map(c => ({
      ...c,
      is_in_my_group: targetGroup ? c.current_group_id === targetGroup.id : false
    }));

    res.json({
      success: true,
      data: enriched,
      myGroupId: targetGroup ? targetGroup.id : null
    });
  } catch (error) {
    console.error('Fetch group candidates error:', error);
    res.status(500).json({ success: false, message: '获取候选成员失败: ' + error.message });
  }
});

// 4. 管理员批量为自己的小组添加组员
router.post('/members', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userIds, groupId } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: '请至少选择一位要添加的组员' });
    }

    let targetGroup;
    if (groupId && req.user.role === 'super_admin') {
      targetGroup = await getOne('SELECT * FROM club_groups WHERE id = ?', [groupId]);
    } else {
      targetGroup = await ensureAdminGroup(req.user);
    }

    if (!targetGroup) {
      return res.status(404).json({ success: false, message: '小组不存在' });
    }

    let addedCount = 0;
    for (const uid of userIds) {
      const userId = Number(uid);
      if (!userId || userId === targetGroup.leader_id) continue;

      // 移除原有的组绑定（一人归属一个主小组）
      await execute('DELETE FROM club_group_members WHERE user_id = ?', [userId]);
      // 写入新组
      await execute('INSERT INTO club_group_members (group_id, user_id) VALUES (?, ?)', [targetGroup.id, userId]);
      addedCount++;
    }

    res.json({
      success: true,
      message: `成功为【${targetGroup.name}】添加了 ${addedCount} 位组员！`,
      addedCount
    });
  } catch (error) {
    console.error('Add group members error:', error);
    res.status(500).json({ success: false, message: '添加组员失败: ' + error.message });
  }
});

// 5. 管理员从小组中移除组员
router.delete('/members/:userId', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { groupId } = req.query;

    let targetGroup;
    if (groupId && req.user.role === 'super_admin') {
      targetGroup = await getOne('SELECT * FROM club_groups WHERE id = ?', [groupId]);
    } else {
      targetGroup = await ensureAdminGroup(req.user);
    }

    if (!targetGroup) {
      return res.status(404).json({ success: false, message: '小组不存在' });
    }

    await execute('DELETE FROM club_group_members WHERE group_id = ? AND user_id = ?', [targetGroup.id, userId]);

    res.json({
      success: true,
      message: '已成功将该成员从本组移除'
    });
  } catch (error) {
    console.error('Remove group member error:', error);
    res.status(500).json({ success: false, message: '移除组员失败: ' + error.message });
  }
});

// 6. 获取全社所有分组列表 (用于超管概览或分组下拉)
router.get('/all', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const groups = await query(`
      SELECT g.*, u.name AS leader_name, u.email AS leader_email, u.qq AS leader_qq,
             (SELECT COUNT(*) FROM club_group_members cgm WHERE cgm.group_id = g.id) AS member_count
      FROM club_groups g
      JOIN users u ON g.leader_id = u.id
      ORDER BY g.id ASC
    `);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Fetch all groups error:', error);
    res.status(500).json({ success: false, message: '获取小组列表失败: ' + error.message });
  }
});

module.exports = router;
