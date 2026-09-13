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
  const memberId = `GEEK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const subject = `🎉【录取通知书】${name} 同学，欢迎加入大学青年极客社团！`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);">

      <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%); padding: 40px 32px; color: #ffffff; text-align: center; position: relative;">
        <div style="position: absolute; top: 12px; left: 24px; font-size: 12px; opacity: 0.7; letter-spacing: 2px;">OFFICIAL ADMISSION LETTER</div>
        <div style="font-size: 48px; margin-bottom: 8px;">🎓</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">录 取 通 知 书</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.92; font-size: 15px; font-weight: 500;">
          University Youth Geek & Innovation Club · Offer Letter
        </p>
      </div>

      <div style="padding: 32px 28px; color: #334155; line-height: 1.85; font-size: 15px;">

        <p style="font-size: 17px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 6px;">
          👋 亲爱的 <span style="color: #7c3aed;">${name}</span> 同学：
        </p>
        <p style="color: #475569; margin-bottom: 4px;">
          🏫 <strong>${college}</strong> · <strong>${className}</strong>
        </p>

        <p style="margin-top: 18px;">
          非常荣幸地通知您，经我社<strong>管理团队与考核委员会</strong>严格、认真审核您提交的《入社申请表》与个人履历材料，您的技术水平、学习热情与团队潜质获得一致高度认可，现决定<strong style="color: #059669;">正式录取您为社团官方成员</strong>！
        </p>

        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #86efac; border-radius: 12px; padding: 20px 24px; margin: 22px 0;">
          <h3 style="margin: 0 0 14px 0; font-size: 16px; color: #065f46;">📋 录用信息确认 · Membership Confirmation</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
            <tr>
              <td style="padding: 6px 0; width: 130px; font-weight: 600; color: #1e293b;">社员编号</td>
              <td style="padding: 6px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 13px;">${memberId}</code></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">系统角色</td>
              <td style="padding: 6px 0;"><span style="background: #fbbf24; color: #78350f; padding: 2px 10px; border-radius: 20px; font-size: 13px; font-weight: 700;">🌟 正式社团成员</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">录用部门/方向</td>
              <td style="padding: 6px 0; font-weight: 500; color: #7c3aed;">${targetDept || '社团核心梯队（按志愿匹配）'}</td>
            </tr>
            ${reviewerNotes ? `
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">审核组评语</td>
              <td style="padding: 6px 0; font-style: italic; color: #065f46;">"${reviewerNotes}"</td>
            </tr>` : ''}
          </table>
        </div>

        <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; padding: 20px 24px; margin: 22px 0;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #854d0e;">🎁 入社即享 · Member Exclusive Benefits</h3>
          <ul style="margin: 0; padding-left: 20px; color: #713f12; line-height: 2;">
            <li><strong>👤 社员身份凭证：</strong>个人中心解锁官方数字认证徽章与凭据编号</li>
            <li><strong>🔒 社内专享通知：</strong>可查阅仅社员可见的内部规章制度与备忘</li>
            <li><strong>🗳️ 活动共创与投票：</strong>发起技术沙龙/创客松提案，参与全员民主表决</li>
            <li><strong>💬 成员交流留言：</strong>在社内交流区畅聊技术，获得管理官方回复</li>
            <li><strong>⚡ 302创客工坊：</strong>全天候自由使用极客工位与私有GPU算力集群（需预约）</li>
          </ul>
        </div>

        <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 20px 24px; margin: 22px 0;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #1e40af;">📌 下一步行动指南 · Onboarding Checklist</h3>
          <ol style="margin: 0; padding-left: 20px; color: #1e3a5f; line-height: 2;">
            <li><strong>登录个人中心：</strong>使用当前账号登录 <a href="/profile" style="color: #2563eb;">官网个人工作台</a>，查看新身份凭证</li>
            <li><strong>加入官方联络群：</strong>QQ大群 <strong style="background: #dbeafe; padding: 2px 8px; border-radius: 4px;">889217643</strong>（入群备注：姓名+部门方向）</li>
            <li><strong>关注迎新活动：</strong>留意近期社团全员迎新大会与部门见面破冰沙龙通知</li>
            <li><strong>完善个人资料：</strong>在个人设置中补充技术栈、GitHub 地址等个人标签</li>
          </ol>
        </div>

        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 28px; text-align: center;">
          🚀 期待在未来的日子里与你并肩探索<br/>
          共同打造校园最强技术极客社区！
        </p>

        <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.8;">
          <div style="font-weight: 700; color: #64748b; font-size: 14px;">大学青年极客社团 · 理事会 & 招新工作组</div>
          <div>📧 官方邮箱：campus@geek.club &nbsp;|&nbsp; 🌐 官网：登录个人中心查看</div>
          <div style="margin-top: 8px;">本邮件由系统在审核通过后自动发送，请勿直接回复</div>
          <div style="font-size: 11px; color: #cbd5e1;">Generated by Campus Club Management System v2.0</div>
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    toName: name,
    subject,
    html,
    text: `【录取通知书】${name} 同学：恭喜你正式通过审核，成为大学青年极客社团正式成员！\n\n录用部门：${targetDept || '社团核心梯队'}\n社员编号：${memberId}\n\n请登录官网个人中心查看数字凭证，并加入官方QQ群 889217643（备注：姓名+部门）。`
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