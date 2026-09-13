const nodemailer = require('nodemailer');
const { query, execute } = require('../db/database');

// 获取邮件系统配置
async function getMailSettings() {
  const rows = await query('SELECT `key`, `value` FROM system_settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

// 邮件发送服务
async function sendEmail({ to, toName, subject, html, text }) {
  const settings = await getMailSettings();
  const isMock = settings.mock_mode === 'true' || !settings.smtp_pass;
  const senderName = settings.smtp_sender_name || '高校学生社团招新组';
  const fromAddress = `"${senderName}" <${settings.smtp_user || 'club-notice@campus.edu'}>`;

  // 记录到数据库发信日志
  const insertLog = async (status, errorMsg = null) => {
    try {
      await execute(`
        INSERT INTO mail_logs (to_email, to_name, subject, content, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [to, toName || '', subject, html || text, status, errorMsg]);
    } catch (e) {
      console.error('[Mail] 写入发信日志失败:', e.message);
    }
  };

  if (isMock) {
    console.log(`\n================== [模拟邮件通知已生成] ==================`);
    console.log(`收件人: ${toName || ''} <${to}>`);
    console.log(`主题: ${subject}`);
    console.log(`发件人: ${fromAddress}`);
    console.log(`内容摘要: ${text ? text.slice(0, 100) : 'HTML富文本'}`);
    console.log(`状态: 模拟发信成功 (可前往管理后台 [邮件日志] 查看完整内容)`);
    console.log(`==========================================================\n`);

    await insertLog('simulated');
    return { success: true, simulated: true, message: '邮件已由系统内置模拟信箱接收并记录' };
  }

  // 真实 SMTP 发信
  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host || 'smtp.qq.com',
      port: parseInt(settings.smtp_port || '465'),
      secure: settings.smtp_secure === 'true',
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass
      }
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || '请使用支持HTML的邮件客户端查看',
      html
    });

    await insertLog('sent');
    console.log(`[Mail] 真实邮件已成功发送至 ${to}, MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Mail Error] 邮件发送至 ${to} 失败:`, error.message);
    await insertLog('failed', error.message);
    return { success: false, error: error.message };
  }
}

// 模板1：入社申请审核通过（录取喜报）
async function sendAdmissionEmail({ to, name, college, className, targetDept, reviewerNotes }) {
  const subject = `🎉【录取喜报】恭喜你正式成为社团成员！`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">🎉 录取通知书</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 15px;">Welcome to Youth Geek & Innovation Club!</p>
      </div>
      <div style="padding: 28px 24px; color: #334155; line-height: 1.7; font-size: 15px;">
        <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">
          亲爱的 <strong>${name}</strong> 同学（${college} - ${className}）：
        </p>
        <p>
          非常荣幸地通知您，经社团管理团队与考核委员会认真审阅您的《入社申请表》，您表现出色，已<strong>正式通过审核，成为社团官方正式成员</strong>！
        </p>
        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">📋 录用信息确认：</p>
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li>所属角色：<strong>社团成员 (Club Member)</strong></li>
            <li>意向/分配部门：<strong>${targetDept || '社团核心梯队'}</strong></li>
            <li>系统权限：已同步解锁官网「社员专区」与「内部专属公告」</li>
            ${reviewerNotes ? `<li>审核评语：<span style="color:#059669;">${reviewerNotes}</span></li>` : ''}
          </ul>
        </div>
        <p><strong>下一步行动指南：</strong></p>
        <ol style="padding-left: 20px; color: #475569;">
          <li>请尽快使用注册账号登录官网个人中心，查看您的社员身份凭证。</li>
          <li>加入社内官方通知QQ大群：<strong>889217643</strong>（入群备注：姓名+部门）。</li>
          <li>关注近期社团全员迎新大会与部门见面破冰活动安排。</li>
        </ol>
        <p style="margin-top: 24px;">期待在未来的日子里与你并肩探索，共创科技与青春的无限可能！</p>
        <div style="margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 13px; color: #94a3b8; text-align: right;">
          高校学生社团理事会 & 招新工作组<br/>
          系统自动发送，请勿直接回复本邮件
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    toName: name,
    subject,
    html,
    text: `亲爱的 ${name} 同学：恭喜你正式通过审核成为社团成员！录用部门：${targetDept || '社团'}。请登录官网查看详情。`
  });
}

// 模板2：入社申请审核驳回（鼓励与反馈）
async function sendRejectionEmail({ to, name, reviewNotes }) {
  const subject = `【社团招新反馈】关于您的入社申请审核进度告知`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #475569; padding: 24px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">关于入社申请的审核反馈</h2>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 14px;">
        <p>亲爱的 <strong>${name}</strong> 同学：</p>
        <p>感谢您对我们社团的热情关注与申请！本次纳新报名人数较多，经综合考量，很遗憾通知您本次入社申请暂未通过。</p>
        ${reviewNotes ? `
          <div style="background: #f1f5f9; border-left: 4px solid #94a3b8; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <strong>审核反馈建议：</strong><br/>
            ${reviewNotes}
          </div>
        ` : ''}
        <p>社团所有的公开技术沙龙、讲座与开放活动依然对全体同学免费开放，欢迎您常来交流互动！待下一轮纳新时也欢迎您再次投递申请！</p>
        <div style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: right;">
          高校学生社团招新组
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    toName: name,
    subject,
    html,
    text: `亲爱的 ${name} 同学：感谢您对本社团的关注，本次申请暂未通过。反馈建议：${reviewNotes || '无'}。欢迎参加公开活动！`
  });
}

module.exports = {
  getMailSettings,
  sendEmail,
  sendAdmissionEmail,
  sendRejectionEmail
};
