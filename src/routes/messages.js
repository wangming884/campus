const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

// 1. 获取留言列表 (全员/成员可见，置顶优先，最新靠前)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const messages = await query(`
      SELECT m.* 
      FROM member_messages m
      ORDER BY m.is_pinned DESC, m.id DESC
    `);

    const isMemberOrAbove = req.user && ['member', 'admin', 'super_admin'].includes(req.user.role);

    res.json({
      success: true,
      data: messages,
      currentUser: req.user ? {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      } : null,
      canPost: Boolean(isMemberOrAbove)
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ success: false, message: '获取留言列表失败: ' + error.message });
  }
});

// 2. 发布社团成员留言 (仅限 社团成员、管理员、超级管理员)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // 检查身份：管理员和超管也是社团成员拥有此功能，普通用户不可发帖
    if (!['member', 'admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: '🔒 您当前身份为【普通用户】。提交入社申请并通过审核成为【社团成员】后，即可解锁社内留言交流权限！'
      });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: '留言内容不可为空' });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ success: false, message: '留言字数请限制在 1000 字以内' });
    }

    const result = await execute(`
      INSERT INTO member_messages (user_id, user_name, user_role, user_college, content, is_pinned)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [
      user.id,
      user.name,
      user.role,
      user.college || '未填写学院',
      content.trim()
    ]);

    res.status(201).json({
      success: true,
      message: '🎉 留言发表成功！',
      data: {
        id: result.lastInsertRowid,
        content: content.trim(),
        user_name: user.name,
        user_role: user.role
      }
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ success: false, message: '发表留言失败: ' + error.message });
  }
});

// 3. 管理员回复留言 (管理员和超级管理员均有权限)
router.post('/:id/reply', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const messageId = req.params.id;
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ success: false, message: '回复内容不能为空' });
    }

    const msg = await getOne('SELECT id, user_name FROM member_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ success: false, message: '未找到该留言' });
    }

    await execute(`
      UPDATE member_messages 
      SET admin_reply = ?, reply_admin_id = ?, reply_admin_name = ?, replied_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      reply.trim(),
      req.user.id,
      req.user.name,
      messageId
    ]);

    res.json({
      success: true,
      message: `已成功回复社员【${msg.user_name}】的留言！`
    });
  } catch (error) {
    console.error('Reply message error:', error);
    res.status(500).json({ success: false, message: '回复失败: ' + error.message });
  }
});

// 4. 置顶/取消置顶留言 (管理员和超管)
router.put('/:id/pin', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const messageId = req.params.id;
    const msg = await getOne('SELECT id, is_pinned FROM member_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ success: false, message: '未找到该留言' });
    }

    const newPinned = msg.is_pinned ? 0 : 1;
    await execute('UPDATE member_messages SET is_pinned = ? WHERE id = ?', [newPinned, messageId]);

    res.json({
      success: true,
      message: newPinned ? '已将该留言置顶展示' : '已取消该留言置顶'
    });
  } catch (error) {
    console.error('Toggle pin error:', error);
    res.status(500).json({ success: false, message: '操作失败: ' + error.message });
  }
});

// 5. 删除留言 (管理员/超管可删任意留言，原作者可删自己未被回复的留言)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.id;
    const msg = await getOne('SELECT * FROM member_messages WHERE id = ?', [messageId]);
    if (!msg) {
      return res.status(404).json({ success: false, message: '未找到该留言' });
    }

    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const isOwner = msg.user_id == req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: '无权删除该留言' });
    }

    await execute('DELETE FROM member_messages WHERE id = ?', [messageId]);

    res.json({
      success: true,
      message: '留言已成功删除'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: '删除失败: ' + error.message });
  }
});

module.exports = router;
