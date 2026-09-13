const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, getOne, execute, templatesDir, submissionsDir } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendAdmissionEmail, sendRejectionEmail } = require('../services/mailer');

// 安全文件过滤器
const safeFileFilter = (req, file, cb) => {
  const allowedExtensions = ['.doc', '.docx', '.pdf', '.xlsx', '.xls', '.zip', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式 (${ext})，请上传 Word、PDF 或 Excel 格式文件`));
  }
};

// 模板存储配置
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templatesDir),
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext).replace(/[^\w\u4e00-\u9fa5-_]/g, '');
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e4);
    cb(null, `${base || 'template'}_${uniqueSuffix}${ext}`);
  }
});
const uploadTemplate = multer({
  storage: templateStorage,
  fileFilter: safeFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// 用户提交申请表存储配置
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, submissionsDir),
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const safeUserName = (req.user ? req.user.name : 'user').replace(/[^\w\u4e00-\u9fa5-_]/g, '');
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e4);
    cb(null, `入社申请_${safeUserName}_${uniqueSuffix}${ext}`);
  }
});
const uploadSubmission = multer({
  storage: submissionStorage,
  fileFilter: safeFileFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// 1. 获取当前生效的入社申请表模板信息 (公开)
router.get('/template/active', async (req, res) => {
  try {
    const template = await getOne(`
      SELECT id, title, filename, size, created_at 
      FROM application_templates 
      WHERE is_active = 1 
      ORDER BY id DESC LIMIT 1
    `);

    if (!template) {
      return res.status(404).json({ success: false, message: '暂无可用的招新申请表模板' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Get active template error:', error);
    res.status(500).json({ success: false, message: '获取模板信息失败' });
  }
});

// 2. 下载招新申请表模板 (公开)
async function handleTemplateDownload(req, res) {
  try {
    let template;
    if (req.params.id) {
      template = await getOne('SELECT * FROM application_templates WHERE id = ?', [req.params.id]);
    } else {
      template = await getOne('SELECT * FROM application_templates WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
    }

    if (!template) {
      return res.status(404).send('申请表模板文件不存在或已被移除');
    }

    // 路径兼容：数据库可能存有 Docker 容器内绝对路径，本地运行时应回退到当前 uploads 目录按文件名查找
    let filePath = template.filepath;
    if (!filePath || !fs.existsSync(filePath)) {
      const fallback = path.join(templatesDir, template.filename || path.basename(filePath || ''));
      if (fs.existsSync(fallback)) filePath = fallback;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('申请表模板文件不存在或已被移除');
    }

    res.download(filePath, template.filename);
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).send('下载模板失败');
  }
}

router.get('/template/download', handleTemplateDownload);
router.get('/template/download/:id', handleTemplateDownload);

// 3. 管理员获取所有模板列表
router.get('/templates', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const list = await query(`
      SELECT t.*, u.name as uploader_name 
      FROM application_templates t
      LEFT JOIN users u ON t.uploaded_by = u.id
      ORDER BY t.id DESC
    `);

    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, message: '获取模板列表失败' });
  }
});

// 4. 管理员上传新申请表模板
router.post('/templates', authenticateToken, requireRole(['admin', 'super_admin']), uploadTemplate.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的模板文件' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const title = req.body.title || originalName;
    const setActive = req.body.set_active === 'true' || req.body.set_active === true;

    if (setActive) {
      await execute('UPDATE application_templates SET is_active = 0');
    }

    const result = await execute(`
      INSERT INTO application_templates (title, filename, filepath, size, is_active, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      originalName,
      req.file.path,
      req.file.size,
      setActive ? 1 : 0,
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: '申请表模板上传成功！',
      data: { id: result.lastInsertRowid, title, filename: originalName }
    });
  } catch (error) {
    console.error('Upload template error:', error);
    res.status(500).json({ success: false, message: '上传模板失败: ' + error.message });
  }
});

// 5. 管理员切换模板启用状态
router.put('/templates/:id/active', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await getOne('SELECT id FROM application_templates WHERE id = ?', [templateId]);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    await execute('UPDATE application_templates SET is_active = 0');
    await execute('UPDATE application_templates SET is_active = 1 WHERE id = ?', [templateId]);

    res.json({ success: true, message: '已成功将该模板设为默认下载模板' });
  } catch (error) {
    console.error('Activate template error:', error);
    res.status(500).json({ success: false, message: '切换失败' });
  }
});

// 6. 管理员删除申请表模板（同时删除文件和历史记录）
router.delete('/templates/:id', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const templateId = req.params.id;
    const template = await getOne('SELECT * FROM application_templates WHERE id = ?', [templateId]);
    if (!template) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    if (template.is_active) {
      return res.status(400).json({ success: false, message: '当前生效的模板不可删除，请先将其他模板设为默认后再删除' });
    }

    if (template.filepath && fs.existsSync(template.filepath)) {
      fs.unlinkSync(template.filepath);
    } else {
      const fallback = path.join(templatesDir, template.filename || path.basename(template.filepath || ''));
      if (fs.existsSync(fallback)) fs.unlinkSync(fallback);
    }

    await execute('DELETE FROM application_templates WHERE id = ?', [templateId]);

    res.json({ success: true, message: '模板已彻底从历史库中删除' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, message: '删除模板失败: ' + error.message });
  }
});

// 7. 普通用户上传填写好的入社申请表并提交审核
router.post('/submit', authenticateToken, uploadSubmission.single('file'), async (req, res) => {
  try {
    const user = req.user;

    // 检查用户当前角色
    if (user.role === 'member' || user.role === 'admin' || user.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: `您当前身份已是【${user.role === 'member' ? '社团成员' : '管理员'}】，无需重复提交入社申请`
      });
    }

    // 检查是否有待审核的申请
    const pending = await getOne('SELECT id FROM membership_applications WHERE user_id = ? AND status = ?', [user.id, 'pending']);
    if (pending) {
      return res.status(400).json({
        success: false,
        message: '您已有正在审核中的入社申请，请耐心等待管理员审核'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传已填写的入社申请表文件（Word/PDF/Excel等）' });
    }

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const { target_dept, statement } = req.body;

    const result = await execute(`
      INSERT INTO membership_applications (
        user_id, name, college, className, qq, email, 
        target_dept, statement, submission_filename, submission_filepath, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      user.id,
      user.name,
      user.college,
      user.className,
      user.qq,
      user.email,
      target_dept || '未指定',
      statement || '',
      originalName,
      req.file.path
    ]);

    res.status(201).json({
      success: true,
      message: '🎉 入社申请提交成功！管理员审核通过后您将晋升为社团成员，审核结果将自动通过邮件通知您。',
      applicationId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ success: false, message: '提交申请失败: ' + error.message });
  }
});

// 7. 用户查看自己的入社申请进度与历史
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const applications = await query(`
      SELECT * FROM membership_applications 
      WHERE user_id = ? 
      ORDER BY id DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({ success: false, message: '获取申请历史失败' });
  }
});

// 8. 下载用户提交的申请表附件
router.get('/download-submission/:id', authenticateToken, async (req, res) => {
  try {
    const app = await getOne('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).send('申请记录不存在');
    }

    // 检查权限
    const isOwner = app.user_id == req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).send('无权下载该申请表');
    }

    // 路径兼容：数据库可能存有 Docker 容器内绝对路径，本地运行时应回退到当前 uploads 目录按文件名查找
    let filePath = app.submission_filepath;
    if (!filePath || !fs.existsSync(filePath)) {
      // 磁盘文件名为「入社申请_用户名_时间戳.扩展名」，优先按磁盘名回退，其次按原始上传名
      const candidates = [
        app.submission_filepath ? path.join(submissionsDir, path.basename(app.submission_filepath)) : null,
        app.submission_filename ? path.join(submissionsDir, app.submission_filename) : null
      ].filter(Boolean);
      filePath = candidates.find(p => fs.existsSync(p));
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('申请表文件已丢失或不存在');
    }

    res.download(filePath, app.submission_filename);
  } catch (error) {
    console.error('Download submission error:', error);
    res.status(500).send('下载失败');
  }
});

// 8b. 在线预览用户提交的申请表附件（不触发下载，直接在浏览器中展示）
router.get('/preview-submission/:id', authenticateToken, async (req, res) => {
  try {
    const app = await getOne('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).send('申请记录不存在');
    }

    const isOwner = app.user_id == req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).send('无权查看该申请表');
    }

    let filePath = app.submission_filepath;
    if (!filePath || !fs.existsSync(filePath)) {
      const candidates = [
        app.submission_filepath ? path.join(submissionsDir, path.basename(app.submission_filepath)) : null,
        app.submission_filename ? path.join(submissionsDir, app.submission_filename) : null
      ].filter(Boolean);
      filePath = candidates.find(p => fs.existsSync(p));
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('申请表文件已丢失或不存在');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const contentType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(app.submission_filename || '') + '"');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Preview submission error:', error);
    res.status(500).send('预览失败');
  }
});

// 9. 管理员获取所有申请列表
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = 'SELECT * FROM membership_applications WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR college LIKE ? OR className LIKE ? OR email LIKE ? OR qq LIKE ?)';
      const k = `%${keyword}%`;
      params.push(k, k, k, k, k);
    }

    sql += ' ORDER BY id DESC';

    const list = await query(sql, params);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, message: '获取申请列表失败' });
  }
});

// 10. 管理员/超管 审核申请
router.post('/:id/review', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const applicationId = req.params.id;
    const { action, review_notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的审核操作，只能为 approve 或 reject' });
    }

    const application = await getOne('SELECT * FROM membership_applications WHERE id = ?', [applicationId]);
    if (!application) {
      return res.status(404).json({ success: false, message: '未找到该入社申请' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // 1. 更新申请记录状态
    await execute(`
      UPDATE membership_applications
      SET status = ?, reviewer_id = ?, reviewer_name = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, req.user.id, req.user.name, review_notes || '', applicationId]);

    // 2. 如果审核通过：将该用户角色升级为「社团成员」
    if (action === 'approve') {
      const targetUser = await getOne('SELECT role FROM users WHERE id = ?', [application.user_id]);
      if (targetUser && targetUser.role === 'user') {
        await execute("UPDATE users SET role = 'member' WHERE id = ?", [application.user_id]);
        console.log(`[Role Update] 用户 ${application.name}(ID: ${application.user_id}) 已正式晋升为社团成员 (member)`);
      }

      // 3. 自动发送录取通知邮件
      await sendAdmissionEmail({
        to: application.email,
        name: application.name,
        college: application.college,
        className: application.className,
        targetDept: application.target_dept,
        reviewerNotes: review_notes
      });

      return res.json({
        success: true,
        message: `审核完成：已批准【${application.name}】入社，用户身份已自动升级为「社团成员」，系统已向 ${application.email} 发送录取喜报邮件！`
      });
    } else {
      // 驳回时：发送反馈邮件
      await sendRejectionEmail({
        to: application.email,
        name: application.name,
        reviewNotes: review_notes
      });

      return res.json({
        success: true,
        message: `审核完成：已驳回【${application.name}】的申请，系统已向 ${application.email} 发送结果反馈邮件。`
      });
    }
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ success: false, message: '审核操作失败: ' + error.message });
  }
});

module.exports = router;