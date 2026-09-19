const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, getOne, execute, templatesDir, submissionsDir } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendAdmissionEmail, sendRejectionEmail } = require('../services/mailer');
const { buildExcelXml, buildCsvWithBom } = require('../utils/excelExporter');
const { isWordDocument, getExpectedPdfPath, convertWordToPdf, getConverterStatus } = require('../utils/docConverter');
const { applicationSubmitLimiter } = require('../middleware/rateLimiter');

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
router.post('/submit', authenticateToken, applicationSubmitLimiter, uploadSubmission.single('file'), async (req, res) => {
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

    // 自动将 Word 申请表转换为 PDF，便于管理员在线审核
    let submissionPdfPath = null;
    if (isWordDocument(req.file.path)) {
      try {
        const conv = await convertWordToPdf(req.file.path);
        if (conv.success && conv.pdfPath) {
          submissionPdfPath = conv.pdfPath;
          console.log(`[Applications] 申请人【${user.name}】提交的 Word 申请表已成功自动转为 PDF: ${submissionPdfPath}`);
        } else {
          console.log(`[Applications] 提交时自动转 PDF 跳过 (${conv.code}): ${conv.error}`);
        }
      } catch (convErr) {
        console.warn('[Applications] 自动转换 PDF 异常 (可在预览时重试):', convErr.message);
      }
    }

    const result = await execute(`
      INSERT INTO membership_applications (
        user_id, name, college, className, qq, email, 
        target_dept, statement, submission_filename, submission_filepath, submission_pdf_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
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
      req.file.path,
      submissionPdfPath
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
      const candidates = [
        app.submission_filepath ? path.join(submissionsDir, path.basename(app.submission_filepath)) : null,
        app.submission_filename ? path.join(submissionsDir, app.submission_filename) : null
      ].filter(Boolean);
      filePath = candidates.find(p => fs.existsSync(p));
    }

    // 支持指定下载已转换好的 PDF 版本
    if (req.query.format === 'pdf' || req.query.pdf === '1') {
      let pdfPath = app.submission_pdf_path;
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        if (filePath) {
          const expected = getExpectedPdfPath(filePath);
          if (fs.existsSync(expected)) pdfPath = expected;
        }
      }

      if ((!pdfPath || !fs.existsSync(pdfPath)) && filePath && isWordDocument(filePath)) {
        const conv = await convertWordToPdf(filePath);
        if (conv.success && conv.pdfPath) {
          pdfPath = conv.pdfPath;
          try {
            await execute('UPDATE membership_applications SET submission_pdf_path = ? WHERE id = ?', [pdfPath, app.id]);
          } catch (e) {}
        }
      }

      if (pdfPath && fs.existsSync(pdfPath)) {
        const originalBase = path.basename(app.submission_filename || filePath, path.extname(app.submission_filename || filePath));
        return res.download(pdfPath, `${originalBase}.pdf`);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('申请表文件已丢失或不存在');
    }

    res.download(filePath, app.submission_filename || path.basename(filePath));
  } catch (error) {
    console.error('Download submission error:', error);
    res.status(500).send('下载失败: ' + error.message);
  }
});

// 8b. 在线预览用户提交的申请表附件（不触发下载，直接在浏览器中展示）
// 支持自动把 Word 文档 (.doc / .docx) 转换为 PDF 在线内联呈现
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

    let fileToServe = filePath;
    let serveMime = null;
    let downloadFilename = app.submission_filename || path.basename(filePath);

    // 若原文件为 Word 文档 (.doc / .docx)，自动提供或按需转换为 PDF 在线展示
    if (isWordDocument(filePath)) {
      let pdfPath = app.submission_pdf_path;
      let validPdf = pdfPath && fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0;

      // 如果记录中没有，检查磁盘上是否已有同名 PDF
      if (!validPdf) {
        const expected = getExpectedPdfPath(filePath);
        if (fs.existsSync(expected) && fs.statSync(expected).size > 0) {
          pdfPath = expected;
          validPdf = true;
        }
      }

      // 尚未生成 PDF 时，触发实时自动转换
      if (!validPdf) {
        console.log(`[Applications] 申请表 #${app.id} 在线预览触发 Word 转 PDF: ${filePath}`);
        const conv = await convertWordToPdf(filePath);
        if (conv.success && conv.pdfPath && fs.existsSync(conv.pdfPath)) {
          pdfPath = conv.pdfPath;
          validPdf = true;
          try {
            await execute('UPDATE membership_applications SET submission_pdf_path = ? WHERE id = ?', [pdfPath, app.id]);
          } catch (dbErr) {
            console.warn('[Applications] 更新 submission_pdf_path 失败:', dbErr.message);
          }
        } else {
          // 转换失败（如环境未安装 LibreOffice）
          if (req.query.check === '1' || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(422).json({
              success: false,
              code: conv.code || 'CONVERSION_FAILED',
              message: conv.error || 'Word 文档转换为 PDF 失败'
            });
          }

          // 输出友好引导页面
          const tokenParam = encodeURIComponent(req.query.token || '');
          const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Word 文档在线转换提示</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 85vh; margin: 0; background: #f8fafc; color: #1e293b; }
  .card { max-width: 540px; margin: 20px; padding: 32px 28px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; border: 1px solid #e2e8f0; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  h2 { font-size: 18px; margin: 0 0 10px; color: #0f172a; }
  p { font-size: 14px; line-height: 1.6; color: #64748b; margin: 8px 0; }
  .alert { background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; padding: 12px; border-radius: 8px; font-size: 13px; text-align: left; margin: 16px 0; }
  .cmd { background: #0f172a; color: #38bdf8; padding: 10px 14px; border-radius: 6px; font-family: Consolas, Monaco, monospace; font-size: 12.5px; text-align: left; margin-top: 6px; word-break: break-all; }
  .actions { margin-top: 24px; display: flex; gap: 10px; justify-content: center; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 6px; font-size: 13.5px; font-weight: 600; text-decoration: none; cursor: pointer; }
  .btn-primary { background: #2563eb; color: #ffffff; border: none; }
  .btn-primary:hover { background: #1d4ed8; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">📑</div>
  <h2>Word 申请表在线预览提示</h2>
  <p>该申请人提交的是 Word 文档（<strong>${downloadFilename}</strong>）。</p>
  <div class="alert">
    <strong>💡 提示：</strong>当前云端服务器尚未安装 LibreOffice 转换工具，暂时无法自动生成 PDF 预览。<br>
    请点击下方按钮直接下载申请表原件，或在云服务器执行以下命令以启用自动转换：
    <div class="cmd">sudo apt-get update &amp;&amp; sudo apt-get install -y libreoffice fonts-wqy-zenhei</div>
  </div>
  <div class="actions">
    <a href="/api/applications/download-submission/${app.id}?token=${tokenParam}" class="btn btn-primary" download>
      📥 下载原 Word 申请表查看
    </a>
  </div>
</div>
</body>
</html>`;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        }
      }

      if (validPdf && pdfPath) {
        fileToServe = pdfPath;
        serveMime = 'application/pdf';
        downloadFilename = path.basename(filePath, path.extname(filePath)) + '.pdf';
      }
    }

    const finalExt = path.extname(fileToServe).toLowerCase();
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

    const contentType = serveMime || mimeMap[finalExt] || 'application/octet-stream';
    const safeEncodedName = encodeURIComponent(downloadFilename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeEncodedName}"; filename*=UTF-8''${safeEncodedName}`);
    fs.createReadStream(fileToServe).pipe(res);
  } catch (error) {
    console.error('Preview submission error:', error);
    res.status(500).send('预览处理失败: ' + error.message);
  }
});

// 8c. 查看当前系统 Word 转 PDF 转换器状态 (管理员/超管)
router.get('/converter-status', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const status = await getConverterStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取转换器状态失败: ' + error.message });
  }
});

// 8d. 手动触发将指定申请表 Word 文档转为 PDF (管理员/超管)
router.post('/:id/convert-pdf', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const app = await getOne('SELECT * FROM membership_applications WHERE id = ?', [req.params.id]);
    if (!app) {
      return res.status(404).json({ success: false, message: '申请记录不存在' });
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
      return res.status(404).json({ success: false, message: '原申请表文件已丢失' });
    }

    if (!isWordDocument(filePath)) {
      return res.status(400).json({ success: false, message: '该申请表附件不是 Word 文档，无需转换' });
    }

    const conv = await convertWordToPdf(filePath);
    if (!conv.success) {
      return res.status(422).json({ success: false, message: conv.error, code: conv.code });
    }

    await execute('UPDATE membership_applications SET submission_pdf_path = ? WHERE id = ?', [conv.pdfPath, app.id]);

    res.json({
      success: true,
      message: 'Word 申请表已成功转换为 PDF 格式',
      pdfPath: conv.pdfPath,
      cached: !!conv.cached
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '转换失败: ' + error.message });
  }
});


// 8c. 导出报名申请花名册为 Excel / CSV 表格 (管理员/超管)
router.get('/export', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { status, keyword, format = 'excel' } = req.query;
    let sql = 'SELECT * FROM membership_applications WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR college LIKE ? OR className LIKE ? OR email LIKE ? OR qq LIKE ?)';
      const k = "%" + keyword + "%";
      params.push(k, k, k, k, k);
    }

    sql += ' ORDER BY id DESC';
    const list = await query(sql, params);

    const columns = [
      { title: '申请编号', key: 'id', width: 70, type: 'Number' },
      { title: '申请人姓名', key: 'name', width: 90 },
      { title: '学院', key: 'college', width: 140 },
      { title: '班级', key: 'className', width: 110 },
      { title: 'QQ号码', key: 'qq', width: 110 },
      { title: '电子邮箱', key: 'email', width: 160 },
      { title: '意向部门', key: 'target_dept', width: 110 },
      { 
        title: '审核状态', 
        key: 'status', 
        width: 90,
        format: (val) => {
          if (val === 'approved') return '审核通过';
          if (val === 'rejected') return '已驳回';
          return '待审核';
        }
      },
      { title: '个人自述/特长', key: 'statement', width: 240 },
      { title: '提交附件文件名', key: 'submission_filename', width: 160 },
      { 
        title: '投递时间', 
        key: 'created_at', 
        width: 140,
        format: (val) => val ? new Date(val).toLocaleString('zh-CN', { hour12: false }) : ''
      },
      { title: '审核人员', key: 'reviewer_name', width: 90 },
      { title: '审核评语', key: 'review_notes', width: 160 },
      { 
        title: '审核时间', 
        key: 'reviewed_at', 
        width: 140,
        format: (val) => val ? new Date(val).toLocaleString('zh-CN', { hour12: false }) : ''
      }
    ];

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const isCsv = format.toLowerCase() === 'csv';

    if (isCsv) {
      const csvContent = buildCsvWithBom(columns, list);
      const filename = encodeURIComponent("社团招新报名花名册_" + timestamp + ".csv");
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
      return res.send(csvContent);
    }

    const excelXml = buildExcelXml(columns, list, '社团招新报名花名册');
    const filename = encodeURIComponent("社团招新报名花名册_" + timestamp + ".xls");
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
    res.send(excelXml);
  } catch (error) {
    console.error('Export applications error:', error);
    res.status(500).json({ success: false, message: '导出报名数据失败: ' + error.message });
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