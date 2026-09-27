const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, getOne, execute, dailyIdeasDir } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { isWordDocument, getExpectedPdfPath, convertWordToPdf } = require('../utils/docConverter');

// 确保存储目录存在
if (!fs.existsSync(dailyIdeasDir)) {
  fs.mkdirSync(dailyIdeasDir, { recursive: true });
}

// 安全文件名转码（防止 UTF-8 中文被 Latin1 二次转码破坏）
function safeOriginalName(raw) {
  if (!raw) return "idea_attachment";
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  try {
    const decoded = Buffer.from(raw, "latin1").toString("utf8");
    if (/[\u4e00-\u9fa5]/.test(decoded)) return decoded;
  } catch (e) {}
  return raw;
}

// 安全附件上传配置
const ideaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dailyIdeasDir),
  filename: (req, file, cb) => {
    const originalName = safeOriginalName(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext).replace(/[^\w\u4e00-\u9fa5-_]/g, '');
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e4);
    cb(null, `每日一设_${base || 'idea'}_${uniqueSuffix}${ext}`);
  }
});

const safeFileFilter = (req, file, cb) => {
  const allowed = ['.doc', '.docx', '.pdf', '.png', '.jpg', '.jpeg', '.zip', '.txt', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式 (${ext})，请上传 Word、PDF 或图片格式附件`));
  }
};

const uploadDailyIdea = multer({
  storage: ideaStorage,
  fileFilter: safeFileFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// 1. 社团成员提交每日一设
router.post('/', authenticateToken, requireRole(['member', 'admin', 'super_admin']), uploadDailyIdea.single('file'), async (req, res) => {
  try {
    const user = req.user;
    const { title, idea_date, category, summary } = req.body;

    if (!title || !title.trim()) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: '请填写设想标题' });
    }

    const trimmedTitle = title.trim();
    const targetDate = idea_date && idea_date.trim() ? idea_date.trim() : new Date().toISOString().split('T')[0];
    const cat = category && category.trim() ? category.trim() : '创新设想';
    const sum = summary ? summary.trim() : '';

    let filePath = null;
    let originalFilename = null;
    let fileSize = 0;
    let pdfPath = null;
    let autoConverted = false;

    if (req.file) {
      filePath = req.file.path;
      originalFilename = safeOriginalName(req.file.originalname);
      fileSize = req.file.size;

      // 如果上传的是 Word 文档，自动转成 PDF 供管理员/组长在线查看
      if (isWordDocument(filePath)) {
        try {
          const conv = await convertWordToPdf(filePath);
          if (conv.success && conv.pdfPath && fs.existsSync(conv.pdfPath)) {
            pdfPath = conv.pdfPath;
            autoConverted = true;
            console.log(`[DailyIdea] 成员【${user.name}】提交的 Word 设想文档已自动转为 PDF: ${pdfPath}`);
          }
        } catch (convErr) {
          console.warn('[DailyIdea] 提交时自动转 PDF 异常 (在线预览时将二次重试):', convErr.message);
        }
      } else if (path.extname(filePath).toLowerCase() === '.pdf') {
        pdfPath = filePath;
      }
    }

    // 查询该社员所在的小组 (若已分组)
    const memberGroup = await getOne(
      'SELECT group_id FROM club_group_members WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    const groupId = memberGroup ? memberGroup.group_id : null;

    const result = await execute(`
      INSERT INTO daily_ideas (
        user_id, user_name, title, idea_date, category, summary,
        file_path, original_filename, file_size, pdf_path, group_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
    `, [
      user.id,
      user.name,
      trimmedTitle,
      targetDate,
      cat,
      sum,
      filePath,
      originalFilename,
      fileSize,
      pdfPath,
      groupId
    ]);

    const newId = result.insertId || result.lastInsertRowid;
    const idea = await getOne('SELECT * FROM daily_ideas WHERE id = ?', [newId]);

    let msg = '🎉 今日设想提交成功！';
    if (autoConverted) {
      msg += ' 所传 Word 文档已自动转换为高清在线预览 PDF。';
    }

    res.json({
      success: true,
      message: msg,
      data: idea
    });
  } catch (error) {
    console.error('Submit daily idea error:', error);
    res.status(500).json({ success: false, message: '提交设想失败: ' + error.message });
  }
});

// 2. 社团成员获取自己的每日一设历史记录
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const ideas = await query(`
      SELECT d.*, g.name AS group_name
      FROM daily_ideas d
      LEFT JOIN club_groups g ON d.group_id = g.id
      WHERE d.user_id = ?
      ORDER BY d.idea_date DESC, d.id DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: ideas
    });
  } catch (error) {
    console.error('Fetch my daily ideas error:', error);
    res.status(500).json({ success: false, message: '获取个人设想列表失败: ' + error.message });
  }
});

// 3. 管理员与组长获取待审阅/全部每日一设列表
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { scope = 'my_group', status, keyword, date, groupId } = req.query;
    const user = req.user;
    const isSuperAdmin = user.role === 'super_admin';

    let sql = `
      SELECT d.*, u.email AS user_email, u.college, u.className, u.qq,
             g.name AS group_name, g.leader_id
      FROM daily_ideas d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN club_groups g ON d.group_id = g.id
      WHERE 1=1
    `;
    const params = [];

    // 普通管理员默认仅查看自己负责小组的成员设想
    if (scope === 'my_group' && !isSuperAdmin) {
      sql += ` AND (
        d.group_id IN (SELECT id FROM club_groups WHERE leader_id = ?)
        OR d.user_id IN (
          SELECT user_id FROM club_group_members 
          WHERE group_id IN (SELECT id FROM club_groups WHERE leader_id = ?)
        )
      )`;
      params.push(user.id, user.id);
    } else if (groupId && groupId !== 'all') {
      sql += ' AND d.group_id = ?';
      params.push(groupId);
    }

    if (status && status !== 'all') {
      sql += ' AND d.status = ?';
      params.push(status);
    }

    if (date && date.trim()) {
      sql += ' AND d.idea_date = ?';
      params.push(date.trim());
    }

    if (keyword && keyword.trim()) {
      const k = `%${keyword.trim()}%`;
      sql += ' AND (d.title LIKE ? OR d.user_name LIKE ? OR d.summary LIKE ? OR u.className LIKE ?)';
      params.push(k, k, k, k);
    }

    sql += ' ORDER BY d.idea_date DESC, d.id DESC';

    const ideas = await query(sql, params);

    // 统计待查阅数量
    let pendingCount = 0;
    if (scope === 'my_group' && !isSuperAdmin) {
      const p = await getOne(`
        SELECT COUNT(*) AS c FROM daily_ideas d
        WHERE d.status = 'submitted'
        AND (
          d.group_id IN (SELECT id FROM club_groups WHERE leader_id = ?)
          OR d.user_id IN (
            SELECT user_id FROM club_group_members 
            WHERE group_id IN (SELECT id FROM club_groups WHERE leader_id = ?)
          )
        )
      `, [user.id, user.id]);
      pendingCount = p ? p.c : 0;
    } else {
      const p = await getOne("SELECT COUNT(*) AS c FROM daily_ideas WHERE status = 'submitted'");
      pendingCount = p ? p.c : 0;
    }

    res.json({
      success: true,
      data: ideas,
      pendingCount
    });
  } catch (error) {
    console.error('Fetch daily ideas error:', error);
    res.status(500).json({ success: false, message: '获取设想列表失败: ' + error.message });
  }
});

// 4. 在线查看设想 PDF 文档 (支持 Word 自动转 PDF 预览)
router.get('/:id/preview-pdf', async (req, res) => {
  try {
    const { getOne, execute } = require('../db/database');
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    // 支持 Header / Cookie / Query Token
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).send('请先登录后预览文档');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(403).send('登录状态失效，请重新登录');
    }

    const user = await getOne('SELECT id, name, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(401).send('用户不存在');

    const idea = await getOne('SELECT * FROM daily_ideas WHERE id = ?', [req.params.id]);
    if (!idea) {
      return res.status(404).send('未找到该设想记录');
    }

    // 鉴权：提交者本人、管理员、超级管理员均有权查看
    const isOwner = idea.user_id === user.id;
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).send('无权查阅该社员的设想文档');
    }

    const filePath = idea.file_path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('该设想未上传附件或原文件已失效');
    }

    let pdfPath = idea.pdf_path;
    let validPdf = pdfPath && fs.existsSync(pdfPath);

    // 如果还没有可用的 PDF，但上传的是 Word 文档，则触发自动转换
    if (!validPdf && isWordDocument(filePath)) {
      console.log(`[DailyIdea] 设想 #${idea.id} 在线预览触发 Word 转 PDF: ${filePath}`);
      const conv = await convertWordToPdf(filePath);
      if (conv.success && conv.pdfPath && fs.existsSync(conv.pdfPath)) {
        pdfPath = conv.pdfPath;
        validPdf = true;
        try {
          await execute('UPDATE daily_ideas SET pdf_path = ? WHERE id = ?', [pdfPath, idea.id]);
        } catch (dbErr) {
          console.warn('[DailyIdea] 更新 daily_ideas pdf_path 失败:', dbErr.message);
        }
      }
    }

    // 如果本身是 PDF 文件
    if (!validPdf && path.extname(filePath).toLowerCase() === '.pdf') {
      pdfPath = filePath;
      validPdf = true;
    }

    // 如果文件是图片，则以图片方式响应
    const ext = path.extname(filePath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const mimeMap = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
      return fs.createReadStream(filePath).pipe(res);
    }

    if (validPdf) {
      const originalBase = path.basename(idea.original_filename || filePath, path.extname(idea.original_filename || filePath));
      const encodedPdfName = encodeURIComponent(`${originalBase}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodedPdfName}"; filename*=UTF-8''${encodedPdfName}`);
      return fs.createReadStream(pdfPath).pipe(res);
    }

    // 无法转换时的友好提示页
    const downloadUrl = `/api/daily-ideas/${idea.id}/download?token=${encodeURIComponent(token)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>文档在线预览提示</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 80vh; margin: 0; background: #f8fafc; color: #1e293b; }
          .box { max-width: 480px; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
          .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="box">
          <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
          <h3>${idea.original_filename || '设想文档'}</h3>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            当前服务器环境尚未检测到 PDF 自动化转换引擎（如 LibreOffice），暂时无法直接在浏览器内渲染该 Word 文档。请直接下载原文件查看。
          </p>
          <a href="${downloadUrl}" class="btn">📥 立即下载文档</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Preview daily idea pdf error:', error);
    res.status(500).send('加载文档预览失败: ' + error.message);
  }
});

// 5. 下载设想原附件或转换后的 PDF
router.get('/:id/download', async (req, res) => {
  try {
    const { getOne } = require('../db/database');
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) return res.status(401).send('请先登录');
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(403).send('凭据失效');
    }

    const idea = await getOne('SELECT * FROM daily_ideas WHERE id = ?', [req.params.id]);
    if (!idea) return res.status(404).send('记录不存在');

    // 鉴权检查：仅作者本人与管理员/超级管理员有权下载
    const isOwner = idea.user_id === decoded.id;
    const isAdmin = ['admin', 'super_admin'].includes(decoded.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).send('无权下载该设想附件');
    }

    const wantPdf = req.query.format === 'pdf';
    let targetFile = idea.file_path;
    let downloadName = idea.original_filename || path.basename(targetFile);

    if (wantPdf) {
      if (idea.pdf_path && fs.existsSync(idea.pdf_path)) {
        targetFile = idea.pdf_path;
        downloadName = path.basename(downloadName, path.extname(downloadName)) + '.pdf';
      }
    }

    if (!targetFile || !fs.existsSync(targetFile)) {
      return res.status(404).send('文件不存在或已被移除');
    }

    const encoded = encodeURIComponent(downloadName);
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    fs.createReadStream(targetFile).pipe(res);
  } catch (error) {
    console.error('Download daily idea error:', error);
    res.status(500).send('下载失败: ' + error.message);
  }
});

// 6. 管理员/组长评阅设想并给出指导反馈
router.post('/:id/review', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { status = 'reviewed', feedback } = req.body;
    const ideaId = Number(req.params.id);

    const idea = await getOne('SELECT * FROM daily_ideas WHERE id = ?', [ideaId]);
    if (!idea) {
      return res.status(404).json({ success: false, message: '设想记录不存在' });
    }

    const reviewer = req.user;

    await execute(`
      UPDATE daily_ideas
      SET status = ?, feedback = ?, reviewer_id = ?, reviewer_name = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, feedback ? feedback.trim() : '', reviewer.id, reviewer.name, ideaId]);

    res.json({
      success: true,
      message: status === 'starred' ? '已将该设想评定为【优秀精选设想】并同步反馈！' : '评阅意见已保存并反馈给成员！'
    });
  } catch (error) {
    console.error('Review daily idea error:', error);
    res.status(500).json({ success: false, message: '评阅失败: ' + error.message });
  }
});

// 7. 删除设想记录
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const ideaId = Number(req.params.id);
    const idea = await getOne('SELECT * FROM daily_ideas WHERE id = ?', [ideaId]);
    if (!idea) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    const isOwner = idea.user_id === req.user.id;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: '无权删除该设想' });
    }

    if (idea.file_path && fs.existsSync(idea.file_path)) {
      try { fs.unlinkSync(idea.file_path); } catch (e) {}
    }
    if (idea.pdf_path && fs.existsSync(idea.pdf_path) && idea.pdf_path !== idea.file_path) {
      try { fs.unlinkSync(idea.pdf_path); } catch (e) {}
    }

    await execute('DELETE FROM daily_ideas WHERE id = ?', [ideaId]);

    res.json({
      success: true,
      message: '设想记录已成功删除'
    });
  } catch (error) {
    console.error('Delete daily idea error:', error);
    res.status(500).json({ success: false, message: '删除失败: ' + error.message });
  }
});

module.exports = router;
