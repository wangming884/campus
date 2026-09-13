const express = require('express');
const router = express.Router();
const { query, execute } = require('../db/database');
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
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_sender_name, mock_mode } = req.body;

    const updates = [
      { key: 'smtp_host', val: smtp_host || 'smtp.qq.com' },
      { key: 'smtp_port', val: String(smtp_port || '465') },
      { key: 'smtp_secure', val: String(smtp_secure === true || smtp_secure === 'true') },
      { key: 'smtp_user', val: smtp_user || '' },
      { key: 'smtp_sender_name', val: smtp_sender_name || '高校学生社团招新组' },
      { key: 'mock_mode', val: String(mock_mode === true || mock_mode === 'true') }
    ];

    if (smtp_pass !== undefined && smtp_pass !== '') {
      updates.push({ key: 'smtp_pass', val: smtp_pass });
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
    res.status(500).json({ success: false, message: '保存邮件设置失败: ' + error.message });
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

module.exports = router;
