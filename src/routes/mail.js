const express = require('express');
const router = express.Router();
const { query, getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getMailSettings, sendEmail } = require('../services/mailer');

// 1. 获取邮件系统配置 (仅超级管理员可查)
router.get('/settings', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const settings = await getMailSettings();
    const safeSettings = {
      ...settings,
      has_pass: Boolean(settings.smtp_pass && settings.smtp_pass.length > 0)
    };
    delete safeSettings.smtp_pass;

    res.json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    console.error('Get mail settings error:', error);
    res.status(500).json({ success: false, message: '获取邮件设置失败: ' + error.message });
  }
});

// 2. 更新邮件配置 (仅超级管理员可设)
router.put('/settings', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, smtp_sender_name, mock_mode } = req.body;
    const useMockMode = mock_mode === true || mock_mode === 'true';
    const smtpHost = String(smtp_host || '').trim();
    const smtpUser = String(smtp_user || '').trim();
    const smtpFrom = String(smtp_from || smtp_user || '').trim();
    const smtpPort = Number.parseInt(smtp_port || '465', 10);

    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return res.status(400).json({
        success: false,
        message: 'SMTP 配置失败：端口必须是 1 到 65535 之间的整数',
        error: 'INVALID_SMTP_PORT'
      });
    }

    if (!useMockMode) {
      if (!smtpHost || !smtpUser || !smtpFrom) {
        return res.status(400).json({
          success: false,
          message: 'SMTP 配置失败：真实 SMTP 模式必须填写服务器地址、SMTP 用户名和发件邮箱地址',
          error: 'MISSING_SMTP_FIELDS'
        });
      }
      if (smtpHost.toLowerCase().includes('resend') && smtpUser.toLowerCase() !== 'resend') {
        return res.status(400).json({
          success: false,
          message: 'SMTP 配置失败：使用 Resend SMTP 时，SMTP 用户名必须填写 resend',
          error: 'INVALID_RESEND_USERNAME'
        });
      }
      if (smtpHost.toLowerCase().includes('resend') && smtpFrom.toLowerCase() === 'resend') {
        return res.status(400).json({
          success: false,
          message: 'SMTP 配置失败：Resend 的发件邮箱地址必须是已验证域名邮箱，不能填写 resend',
          error: 'INVALID_RESEND_FROM'
        });
      }
      if (smtp_pass === undefined || String(smtp_pass).trim() === '') {
        const existing = await getMailSettings();
        if (!String(existing.smtp_pass || '').trim()) {
          return res.status(400).json({
            success: false,
            message: 'SMTP 配置失败：真实 SMTP 模式必须填写授权码或 API Key',
            error: 'MISSING_SMTP_PASSWORD'
          });
        }
      }
    }

    const updates = [
      { key: 'smtp_host', val: smtpHost || 'smtp.qq.com' },
      { key: 'smtp_port', val: String(smtpPort) },
      { key: 'smtp_secure', val: String(smtp_secure === true || smtp_secure === 'true') },
      { key: 'smtp_user', val: smtpUser },
      { key: 'smtp_from', val: smtpFrom },
      { key: 'smtp_sender_name', val: smtp_sender_name || '高校学生社团招新组' },
      { key: 'mock_mode', val: String(useMockMode) }
    ];

    if (smtp_pass !== undefined && smtp_pass !== '') {
      updates.push({ key: 'smtp_pass', val: String(smtp_pass).trim() });
    }

    for (const item of updates) {
      await execute('REPLACE INTO system_settings (`key`, `value`) VALUES (?, ?)', [item.key, item.val]);
    }

    res.json({
      success: true,
      message: '邮件服务参数更新成功！'
    });
  } catch (error) {
    console.error('Update mail settings error:', error);
    res.status(500).json({
      success: false,
      message: 'SMTP 配置保存失败：' + error.message,
      error: error.message
    });
  }
});

// 3. 发送测试邮件 (超级管理员)
router.post('/test', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const { test_email } = req.body;
    if (!test_email) {
      return res.status(400).json({ success: false, message: '请输入测试收件邮箱' });
    }

    const result = await sendEmail({
      to: test_email,
      toName: '系统测试员',
      subject: '📧 高校社团官网与管理系统 - 邮件发送连通性测试',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #3b82f6;">恭喜！邮件服务配置成功 🎉</h2>
          <p>这是一封来自社团管理系统的连通性测试邮件。</p>
          <p>当管理员在后台审核通过普通用户的入社申请时，系统将使用此配置自动向申请人发送录取喜报与入社指引！</p>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 20px;">发送时间：${new Date().toLocaleString()}</div>
        </div>
      `,
      text: '社团管理系统邮件服务测试成功！'
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.simulated
          ? '【模拟发信成功】当前处于模拟模式，测试邮件已成功记录在后台 [邮件日志] 中！'
          : `测试邮件已成功发送至 ${test_email}，请查收！`
      });
    } else {
      res.status(500).json({
        success: false,
        message: `发信失败：${result.error}`
      });
    }
  } catch (error) {
    console.error('Test mail error:', error);
    res.status(500).json({ success: false, message: '测试发信失败: ' + error.message });
  }
});

// 4. 获取邮件发送日志 (管理员和超级管理员均可查看)
router.get('/logs', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const logs = await query(`
      SELECT * FROM mail_logs 
      ORDER BY id DESC 
      LIMIT 100
    `);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Fetch mail logs error:', error);
    res.status(500).json({ success: false, message: '获取邮件日志失败: ' + error.message });
  }
});

// 批量删除系统发信日志（仅管理员和超级管理员）
router.delete('/logs/batch', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids)
      ? [...new Set(req.body.ids.map(Number).filter(Number.isInteger))]
      : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的发信日志' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const result = await execute(`DELETE FROM mail_logs WHERE id IN (${placeholders})`, ids);
    res.json({ success: true, message: `已删除 ${result.changes} 条发信日志` });
  } catch (error) {
    console.error('Batch delete mail logs error:', error);
    res.status(500).json({ success: false, message: '批量删除发信日志失败: ' + error.message });
  }
});

// 5. 获取可发送邮件的收件人用户列表 (管理员和超级管理员)
router.get('/recipients', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const users = await query(
      'SELECT id, name, email, role, college, className FROM users ORDER BY id ASC'
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Fetch recipients error:', error);
    res.status(500).json({ success: false, message: '获取收件人列表失败: ' + error.message });
  }
});

// 6. 管理员向单个用户发送自定义邮件
router.post('/send', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { to_user_id, subject, html_content } = req.body;

    if (!to_user_id || !subject || !html_content) {
      return res.status(400).json({ success: false, message: '请完整填写收件人、邮件主题和正文内容' });
    }

    const targetUser = await getOne('SELECT id, name, email FROM users WHERE id = ?', [to_user_id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '目标收件人用户不存在' });
    }

    if (!targetUser.email) {
      return res.status(400).json({ success: false, message: '该用户未登记邮箱地址' });
    }

    const result = await sendEmail({
      to: targetUser.email,
      toName: targetUser.name,
      subject: subject,
      html: html_content,
      text: html_content.replace(/<[^>]*>/g, '')
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.simulated
          ? `【模拟发信成功】邮件已记录至后台日志，收件人：${targetUser.name} (${targetUser.email})`
          : `邮件已成功发送至 ${targetUser.name} (${targetUser.email})`
      });
    } else {
      res.status(500).json({
        success: false,
        message: `发信失败：${result.error}`
      });
    }
  } catch (error) {
    console.error('Send mail error:', error);
    res.status(500).json({ success: false, message: '发送邮件失败: ' + error.message });
  }
});

module.exports = router;