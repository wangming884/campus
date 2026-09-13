const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

// 1. 获取活动提案列表 (支持按状态筛选，附带当前用户投票状态)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM activity_proposals WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY status = "approved_to_hold" DESC, status = "voting" DESC, vote_count DESC, id DESC';

    const proposals = await query(sql, params);

    // 查询当前用户的投票记录
    let userVotedIds = new Set();
    if (req.user) {
      const votes = await query('SELECT proposal_id FROM proposal_votes WHERE user_id = ?', [req.user.id]);
      userVotedIds = new Set(votes.map(v => v.proposal_id));
    }

    const data = proposals.map(p => ({
      ...p,
      hasVoted: userVotedIds.has(p.id)
    }));

    const isMemberOrAbove = req.user && ['member', 'admin', 'super_admin'].includes(req.user.role);

    res.json({
      success: true,
      data,
      canPropose: Boolean(isMemberOrAbove),
      canVote: Boolean(isMemberOrAbove)
    });
  } catch (error) {
    console.error('Fetch proposals error:', error);
    res.status(500).json({ success: false, message: '获取活动提案失败: ' + error.message });
  }
});

// 2. 查看单个活动提案详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const proposal = await getOne('SELECT * FROM activity_proposals WHERE id = ?', [req.params.id]);
    if (!proposal) {
      return res.status(404).json({ success: false, message: '活动提案不存在' });
    }

    let hasVoted = false;
    if (req.user) {
      const vote = await getOne('SELECT id FROM proposal_votes WHERE proposal_id = ? AND user_id = ?', [proposal.id, req.user.id]);
      hasVoted = Boolean(vote);
    }

    res.json({
      success: true,
      data: {
        ...proposal,
        hasVoted
      }
    });
  } catch (error) {
    console.error('Get proposal detail error:', error);
    res.status(500).json({ success: false, message: '获取活动详情失败: ' + error.message });
  }
});

// 3. 社团成员发起新活动提案 (社员、管理员、超级管理员均可)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // 检查身份：管理员和超管也是社团成员拥有社团成员一切功能
    if (!['member', 'admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: '🔒 您当前身份为【普通用户】。成为【社团成员】后，即可解锁发起活动请求与为活动投票的权限！'
      });
    }

    const {
      title,
      category,
      expected_time,
      expected_location,
      budget,
      description,
      details
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '请提供活动名称' });
    }

    if (!details || !details.trim()) {
      return res.status(400).json({ success: false, message: '请详细描述活动要求与执行细节' });
    }

    const result = await execute(`
      INSERT INTO activity_proposals (
        user_id, creator_name, creator_role, creator_college,
        title, category, expected_time, expected_location, budget, description, details, status, vote_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'voting', 1)
    `, [
      user.id,
      user.name,
      user.role,
      user.college || '未填写学院',
      title.trim(),
      category || '技术沙龙',
      expected_time || '待定',
      expected_location || '待定',
      budget || '待核算',
      (description || '').trim(),
      details.trim()
    ]);

    const newId = result.lastInsertRowid;

    // 发起人自动投第一票支持
    try {
      await execute('INSERT INTO proposal_votes (proposal_id, user_id, user_name) VALUES (?, ?, ?)', [newId, user.id, user.name]);
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: '🎉 活动提案发起成功！已进入社内投票阶段，等待社员支持与管理员终审举办决议！',
      data: { id: newId }
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    res.status(500).json({ success: false, message: '发起活动提案失败: ' + error.message });
  }
});

// 4. 社员为活动提案投票 (一人一票，点赞支持或取消支持)
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const proposalId = req.params.id;

    if (!['member', 'admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: '🔒 您当前身份为普通用户，需先入社成为社员后方可参与活动投票'
      });
    }

    const proposal = await getOne('SELECT id, status, vote_count FROM activity_proposals WHERE id = ?', [proposalId]);
    if (!proposal) {
      return res.status(404).json({ success: false, message: '未找到该活动提案' });
    }

    // 检查是否已投过票
    const existingVote = await getOne('SELECT id FROM proposal_votes WHERE proposal_id = ? AND user_id = ?', [proposalId, user.id]);

    if (existingVote) {
      // 取消投票
      await execute('DELETE FROM proposal_votes WHERE id = ?', [existingVote.id]);
      await execute('UPDATE activity_proposals SET vote_count = vote_count - 1 WHERE id = ? AND vote_count > 0', [proposalId]);

      const updated = await getOne('SELECT vote_count FROM activity_proposals WHERE id = ?', [proposalId]);

      return res.json({
        success: true,
        hasVoted: false,
        voteCount: updated.vote_count,
        message: '已取消对该活动的投票支持'
      });
    } else {
      // 新增投票
      await execute('INSERT INTO proposal_votes (proposal_id, user_id, user_name) VALUES (?, ?, ?)', [proposalId, user.id, user.name]);
      await execute('UPDATE activity_proposals SET vote_count = vote_count + 1 WHERE id = ?', [proposalId]);

      const updated = await getOne('SELECT vote_count FROM activity_proposals WHERE id = ?', [proposalId]);

      return res.json({
        success: true,
        hasVoted: true,
        voteCount: updated.vote_count,
        message: '👍 成功为该活动投出一票！'
      });
    }
  } catch (error) {
    console.error('Vote proposal error:', error);
    res.status(500).json({ success: false, message: '投票失败: ' + error.message });
  }
});

// 5. 管理员最终决议是否举办活动 (仅管理员和超级管理员)
router.post('/:id/decision', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const proposalId = req.params.id;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的决议操作，只能为 approve (批准举办) 或 reject (驳回暂不举办)' });
    }

    const proposal = await getOne('SELECT * FROM activity_proposals WHERE id = ?', [proposalId]);
    if (!proposal) {
      return res.status(404).json({ success: false, message: '未找到该活动提案' });
    }

    const newStatus = action === 'approve' ? 'approved_to_hold' : 'rejected';

    await execute(`
      UPDATE activity_proposals 
      SET status = ?, admin_decision_notes = ?, decided_by = ?, decided_admin_name = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      newStatus,
      (notes || '').trim(),
      req.user.id,
      req.user.name,
      proposalId
    ]);

    const msg = action === 'approve'
      ? `🎉 决议通过：已批准并决定举办【${proposal.title}】活动！`
      : `决议完成：已对【${proposal.title}】做出暂不举办决议。`;

    res.json({
      success: true,
      message: msg,
      newStatus
    });
  } catch (error) {
    console.error('Proposal decision error:', error);
    res.status(500).json({ success: false, message: '决议提交失败: ' + error.message });
  }
});

module.exports = router;
