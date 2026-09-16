require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 确保上传与数据存储目录存在
const uploadsDir = path.join(__dirname, '../../uploads');
const templatesDir = path.join(uploadsDir, 'templates');
const submissionsDir = path.join(uploadsDir, 'submissions');
const clubFilesDir = path.join(uploadsDir, 'club');
[uploadsDir, templatesDir, submissionsDir, clubFilesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

let pool = null;
let isMySQL = false;

// SQLite 回退支撑（仅在本地未启动 MySQL 容器时作为自动安全备份）
let sqliteDb = null;

// 数据库初始化主方法
async function initDatabase(retries = 5, delay = 3000) {
  // 若环境变量指定直接使用 SQLite，跳过 MySQL 连接尝试
  if (process.env.USE_SQLITE === 'true') {
    console.log('[DB] 🔧 已配置为直接使用本地嵌入式数据库（SQLite）模式');
    initFallbackSQLite();
    return false;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3307');
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root123456';
  const database = process.env.DB_NAME || 'campus_club';

  console.log(`[DB] 正在尝试连接 MySQL 数据库 (${host}:${port}, 库名: ${database})...`);

  for (let i = 1; i <= retries; i++) {
    try {
      // 1. 尝试无库连接以创建目标数据库
      const initialConn = await mysql.createConnection({ host, port, user, password });
      await initialConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await initialConn.end();

      // 2. 创建连接池
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });

      // 3. 测试连接
      const conn = await pool.getConnection();
      conn.release();

      isMySQL = true;
      console.log(`[DB] ✅ 成功连接 MySQL 数据库 (${host}:${port}/${database})！`);

      // 4. 创建表结构与预置数据
      await createMySQLTables();
      await seedMySQLData();
      return true;
    } catch (err) {
      console.warn(`[DB] 第 ${i}/${retries} 次连接 MySQL 失败: ${err.message}`);
      if (i < retries) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  // 若重试完毕仍未连上 MySQL（通常发生在本地未启动 Docker 容器时），启用嵌入式引擎应急
  console.warn(`[DB] ⚠️ 未能连接到外部 MySQL，正在自动启用本地嵌入式数据库应急运行...`);
  initFallbackSQLite();
  return false;
}

// 创建 MySQL 数据表
async function createMySQLTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      college VARCHAR(100) NOT NULL,
      className VARCHAR(100) NOT NULL,
      qq VARCHAR(50) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_config (
      id INT PRIMARY KEY,
      club_name VARCHAR(255) NOT NULL,
      hero_badge VARCHAR(255),
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT,
      about_title VARCHAR(255) NOT NULL,
      about_content TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      departments_json TEXT NOT NULL,
      contact_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS club_documents (
      id INT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      filepath TEXT NOT NULL,
      mime_type VARCHAR(150),
      size BIGINT DEFAULT 0,
      uploaded_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      filepath TEXT NOT NULL,
      size BIGINT DEFAULT 0,
      is_active TINYINT DEFAULT 1,
      uploaded_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      college VARCHAR(100) NOT NULL,
      className VARCHAR(100) NOT NULL,
      qq VARCHAR(50) NOT NULL,
      email VARCHAR(191) NOT NULL,
      target_dept VARCHAR(100),
      statement TEXT,
      submission_filename VARCHAR(255),
      submission_filepath TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      reviewer_id INT,
      reviewer_name VARCHAR(100),
      review_notes TEXT,
      reviewed_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'public',
      tag VARCHAR(50) DEFAULT '通知',
      author_id INT,
      author_name VARCHAR(100),
      views INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mail_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      to_email VARCHAR(191) NOT NULL,
      to_name VARCHAR(100),
      subject VARCHAR(255) NOT NULL,
      content MEDIUMTEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'sent',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      \`value\` TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email VARCHAR(191) PRIMARY KEY,
      code_hash VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      sent_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      path VARCHAR(200) NOT NULL,
      is_system TINYINT DEFAULT 0,
      is_nav_visible TINYINT DEFAULT 1,
      sort_order INT DEFAULT 0,
      seo_description TEXT,
      content LONGTEXT,
      content_html LONGTEXT,
      template_config TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await pool.query('ALTER TABLE site_pages ADD COLUMN content_html LONGTEXT');
  } catch (error) {
    if (!/duplicate|exists/i.test(error.message)) throw error;
  }
  try {
    await pool.query('ALTER TABLE site_pages ADD COLUMN template_config TEXT');
  } catch (error) {
    if (!/duplicate|exists/i.test(error.message)) throw error;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      user_role VARCHAR(50) NOT NULL,
      user_college VARCHAR(100),
      content TEXT NOT NULL,
      is_pinned TINYINT DEFAULT 0,
      admin_reply TEXT,
      reply_admin_id INT,
      reply_admin_name VARCHAR(100),
      replied_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_proposals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      creator_name VARCHAR(100) NOT NULL,
      creator_role VARCHAR(50) NOT NULL,
      creator_college VARCHAR(100),
      title VARCHAR(200) NOT NULL,
      category VARCHAR(50) DEFAULT '技术沙龙',
      expected_time VARCHAR(100),
      expected_location VARCHAR(100),
      budget VARCHAR(100),
      description TEXT,
      details LONGTEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'voting',
      vote_count INT DEFAULT 0,
      admin_decision_notes TEXT,
      decided_by INT,
      decided_admin_name VARCHAR(100),
      decided_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposal_votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      proposal_id INT NOT NULL,
      user_id INT NOT NULL,
      user_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_proposal_user (proposal_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS development_directions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      user_email VARCHAR(191) NOT NULL,
      current_role VARCHAR(50) NOT NULL,
      target_role VARCHAR(50) NOT NULL DEFAULT 'admin',
      target_direction VARCHAR(200),
      reason TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      reviewer_id INT,
      review_notes TEXT,
      reviewed_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

// 预置 MySQL 种子数据
async function seedMySQLData() {
  // 1. 初始化超级管理员
  const [adminRows] = await pool.query('SELECT id FROM users WHERE role = ?', ['super_admin']);
  if (adminRows.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Admin@123456', salt);
    await pool.query(`
      INSERT INTO users (name, email, password, college, className, qq, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['超级管理员', 'superadmin@campus.club', hash, '计算机与软件学院', '软件工程卓越班', '100000001', 'super_admin']);
    console.log('[MySQL] 初始化超级管理员已创建: superadmin@campus.club / Admin@123456');
  }

  // 2. 初始化官网默认展示内容
  const [portalRows] = await pool.query('SELECT id FROM portal_config WHERE id = 1');
  if (portalRows.length === 0) {
    const defaultStats = JSON.stringify([
      { label: '注册在册社员', value: '380+', unit: '人', icon: 'users' },
      { label: '年度精品活动', value: '45+', unit: '场', icon: 'calendar' },
      { label: '国家/省校级荣誉', value: '32', unit: '项', icon: 'award' },
      { label: '核心职能部门', value: '5', unit: '大部门', icon: 'layers' }
    ]);

    const defaultDepartments = JSON.stringify([
      {
        id: 'tech',
        name: '技术研发部',
        badge: '核心科技',
        intro: '致力于全栈Web开发、AI大模型与智能硬件创新，组织技术工作坊、黑客马拉松及实战开源项目研发。',
        skills: 'JavaScript / Python / C++ / UI设计',
        icon: 'code'
      },
      {
        id: 'plan',
        name: '活动策划部',
        badge: '创意引擎',
        intro: '负责社团大型科技文化节、前沿学术沙龙、迎新破冰舞会等品牌活动方案构想与落地调度。',
        skills: '文案策划 / 现场调度 / 跨部门协作',
        icon: 'compass'
      },
      {
        id: 'media',
        name: '融媒宣传部',
        badge: '视觉之声',
        intro: '社团官方形象与新媒体矩阵运营掌舵人，负责摄影摄像、推文设计、短视频剪辑与周边视觉打造。',
        skills: '摄影 / 视频剪辑 / 平面设计 / 排版',
        icon: 'camera'
      },
      {
        id: 'outreach',
        name: '外联合作部',
        badge: '资源纽带',
        intro: '连接高校兄弟社团与一线科技名企，拓展活动赞助、名企参访、跨校技术交流与导师讲座。',
        skills: '商务沟通 / 赞助洽谈 / 社交礼仪',
        icon: 'globe'
      },
      {
        id: 'admin_dept',
        name: '组织实践部',
        badge: '坚强后盾',
        intro: '社团日常运转中枢，统筹社员档案、绩效考核、活动室工位预约、物资保障与内部团建。',
        skills: '档案管理 / 财务报销 / 人文关怀',
        icon: 'shield'
      }
    ]);

    const defaultContact = JSON.stringify({
      email: 'contact@campus.club',
      location: '大学生活动中心 302 发明创新协会工坊',
      qqGroup: '889217643',
      wechat: 'Campus_Geek_Club',
      recruitmentDate: '每年春季 / 秋季学期初开学前三周'
    });

    await pool.query(`
      INSERT INTO portal_config (
        id, club_name, hero_badge, hero_title, hero_subtitle, 
        about_title, about_content, stats_json, departments_json, contact_json
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      '发明创新协会',
      '✨ 2026 秋季招新现已全面开启',
      '追逐代码与科技之光，共筑大学卓越青春',
      '我们汇聚全校对科技研发、创意策划与融媒宣传充满热忱的青年学子，提供施展才华的开放平台与前沿实战空间。',
      '关于我们的社团',
      '发明创新协会成立于2018年，是校团委直属的五星级科技学术类社团。社团始终坚持“求真、务实、探索、创新”的初心，以项目实战驱动技能成长，以多元活动凝聚青年力量。社团拥有独立的工作室硬件工位与全天候开发环境，定期举办“极客创想夜”、“名企参访”、“全国高校算法友谊赛”等活动，已累计培养数百位进入顶尖大厂与优秀学府深造的杰出校友。',
      defaultStats,
      defaultDepartments,
      defaultContact
    ]);
  }

  // 3. 初始化模板文件
  const [tplRows] = await pool.query('SELECT id FROM application_templates WHERE is_active = 1');
  if (tplRows.length === 0) {
    const templateFileName = '2026学年社团入社申请登记表_官方模板.docx';
    const templatePath = path.join(templatesDir, templateFileName);
    if (!fs.existsSync(templatePath)) {
      const sampleContent = `【高校学生社团入社申请登记表】\n\n` +
        `一、基本个人信息：\n` +
        `姓名：____________    性别：____    学院：____________    专业班级：____________\n` +
        `QQ号码：____________  手机/微信：____________   常用邮箱：____________\n\n` +
        `二、申请意向与志愿：\n` +
        `第一志愿部门：[ ] 技术研发部  [ ] 活动策划部  [ ] 融媒宣传部  [ ] 外联合作部  [ ] 组织实践部\n\n` +
        `三、个人特长与经验简述：\n\n` +
        `申请人签名：____________    日期：2026年___月___日\n`;
      fs.writeFileSync(templatePath, sampleContent, 'utf-8');
    }

    await pool.query(`
      INSERT INTO application_templates (title, filename, filepath, size, is_active, uploaded_by)
      VALUES (?, ?, ?, ?, 1, 1)
    `, [
      '2026学年学生社团入社申请表（官方标准版）',
      templateFileName,
      templatePath,
      fs.statSync(templatePath).size
    ]);
  }

  // 4. 初始化默认通知公告
  const [noticeCount] = await pool.query('SELECT COUNT(*) as count FROM notices');
  if (noticeCount[0].count === 0) {
    const defaultNotices = [
      {
        title: '【招新公告】2026新学期招新纳新通道正式开启，欢迎新同学加入！',
        content: '亲爱的同学们：新学期新气象，社团面向全校全体本科生与研究生开启纳新通道！请在官网【纳新通道】下载《入社申请表模板》，填写完毕后登录账号上传提交，管理团队将在48小时内完成审核并发送邮件通知结果！',
        category: 'public',
        tag: '招新通告'
      },
      {
        title: '【学术讲座】“大语言模型与智能体应用开发实战”技术沙龙预告',
        content: '本周五晚上 19:00 将在活动中心 302 举行前沿技术沙龙，由技术部负责人主讲，欢迎全校对AI和编程感兴趣的同学参与交流！',
        category: 'public',
        tag: '活动预告'
      },
      {
        title: '【社员专属】社团活动室工位使用规章与项目云服务器申请流程',
        content: '亲爱的社员伙伴们：为保障工位高效有序运转，请各位社员遵守工位使用准则。如个人或小组有开源项目需云服务器支持，请在群内联系技术主管登记领取免费测试节点。',
        category: 'member',
        tag: '社内必读'
      }
    ];

    for (const notice of defaultNotices) {
      await pool.query(`
        INSERT INTO notices (title, content, category, tag, author_id, author_name)
        VALUES (?, ?, ?, ?, 1, '超级管理员')
      `, [notice.title, notice.content, notice.category, notice.tag]);
    }
  }

  // 5. 初始化邮件默认设置
  const defaultMailSettings = [
    { key: 'smtp_host', value: 'smtp.qq.com' },
    { key: 'smtp_port', value: '465' },
    { key: 'smtp_secure', value: 'true' },
    { key: 'smtp_user', value: 'youth_geek_club@qq.com' },
    { key: 'smtp_pass', value: '' },
    { key: 'smtp_sender_name', value: '发明创新协会招新组' },
    { key: 'mock_mode', value: 'true' }
  ];

  for (const s of defaultMailSettings) {
    const [exist] = await pool.query('SELECT `key` FROM system_settings WHERE `key` = ?', [s.key]);
    if (exist.length === 0) {
      await pool.query('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?)', [s.key, s.value]);
    }
  }

  const [registrationLimitSetting] = await pool.query('SELECT `key` FROM system_settings WHERE `key` = ?', ['registration_limit']);
  if (registrationLimitSetting.length === 0) {
    await pool.query('INSERT INTO system_settings (`key`, `value`) VALUES (?, ?)', ['registration_limit', '1000']);
  }

  // 6. 初始化核心网页列表 (site_pages)
  const [pageCount] = await pool.query('SELECT COUNT(*) as count FROM site_pages');
  if (pageCount[0].count === 0) {
    const defaultPages = [
      {
        title: '首页',
        slug: 'home',
        path: '/',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 1,
        seo_description: '高校发明创新协会官方主页，探索前沿科技，驱动创新创造。',
        content: '社团官方门户主页，包含 Hero 动态光效、四大硬核特色与核心数据指标。'
      },
      {
        title: '关于我们',
        slug: 'about',
        path: '/about',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 2,
        seo_description: '发明创新协会发展历程、荣誉资质与社团核心文化价值观。',
        content: '社团发展历程编年史时间轴（2018-2026）、四大核心文化价值观卡片与国家级/省部级荣誉墙。'
      },
      {
        title: '部门架构',
        slug: 'departments',
        path: '/departments',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 3,
        seo_description: '5大核心职能部门全景解析、技能图谱与招募画像。',
        content: '技术研发部、视觉文创部、活动策划部、公关外联部、组织实践部等5大职能部门全景图谱。'
      },
      {
        title: '纳新通道',
        slug: 'recruitment',
        path: '/recruitment',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 4,
        seo_description: '社团春季/秋季纳新流程、官方申请表模板下载与在线提交入社。',
        content: '官方申请表模板一键下载卡片、在线拖拽提交申请表表单与招新常见问题解答 FAQ。'
      },
      {
        title: '通知公告',
        slug: 'notices',
        path: '/notices',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 5,
        seo_description: '社团最新全校公开通告、技术研讨会日程与社员内部专享规章。',
        content: '分类筛选标签页（全部、全校公开、社团成员专享）、关键词搜索与详情模态弹窗阅读。'
      },
      {
        title: '联系方式',
        slug: 'contact',
        path: '/contact',
        is_system: 1,
        is_nav_visible: 1,
        sort_order: 6,
        seo_description: '工作室坐标、官方邮箱、迎新QQ群与在线咨询合作。',
        content: '四大联络渠道卡片、在线留言咨询表单与线下活动中心拜访须知。'
      }
    ];

    for (const p of defaultPages) {
      await pool.query(`
        INSERT INTO site_pages (title, slug, path, is_system, is_nav_visible, sort_order, seo_description, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.title, p.slug, p.path, p.is_system, p.is_nav_visible, p.sort_order, p.seo_description, p.content]);
    }
  }

  // 7. 初始化留言板种子数据 (member_messages)
  const [msgCount] = await pool.query('SELECT COUNT(*) as count FROM member_messages');
  if (msgCount[0].count === 0) {
    await pool.query(`
      INSERT INTO member_messages (user_id, user_name, user_role, user_college, content, is_pinned, admin_reply, reply_admin_id, reply_admin_name, replied_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 1, '超级管理员', NOW())
    `, [
      1,
      '超级管理员',
      'super_admin',
      '计算机与软件学院',
      '🎉 欢迎大家常驻社内交流专区！如果有任何关于社团活动构想、技术沙龙选题、硬件工具借用或组队参赛的需求，随时在下方留言交流！',
      '收到！管理团队将保持每日查阅，积极协同推进大家的创意落地！'
    ]);
  }

  // 8. 初始化活动提案种子数据 (activity_proposals)
  const [propCount] = await pool.query('SELECT COUNT(*) as count FROM activity_proposals');
  if (propCount[0].count === 0) {
    await pool.query(`
      INSERT INTO activity_proposals (
        user_id, creator_name, creator_role, creator_college, 
        title, category, expected_time, expected_location, budget, description, details, status, vote_count, admin_decision_notes, decided_by, decided_admin_name, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved_to_hold', 12, '方案详实，符合社团学期技术深耕规划，经费预算合理，管理组一致批准筹备！', 1, '超级管理员', NOW())
    `, [
      1,
      '超级管理员',
      'super_admin',
      '计算机与软件学院',
      '《开源鸿蒙与端侧轻量AI开发实战工坊》',
      '技术沙龙',
      '2026年10月下旬 周六下午 14:00-17:30',
      '大学生活动中心 302 发明创新协会工坊',
      '约 600 元（物料与茶歇）',
      '面向全校编程爱好者与社内成员，邀请业界一线导师现场指导嵌入式开源鸿蒙环境搭建与端侧 AI 模型轻量化实战部署。',
      '1. 场地投影与网络环境提前联调\n2. 社团提供20套开源鸿蒙开发套件供现场编组实操\n3. 现场茶歇准备与参会极客贴纸派发\n4. 设立现场最佳实战Demo评优奖励'
    ]);
  }

  // 9. 初始化发展意向方向 (development_directions)
  const [dirCount] = await pool.query('SELECT COUNT(*) as count FROM development_directions');
  if (dirCount[0].count === 0) {
    const defaultDirections = [
      { title: '前沿全栈与AI研发方向 (Web/AI/嵌入式/云原生)', sort_order: 1 },
      { title: '高水平科技竞赛方向 (中国国际创新大赛/挑战杯/算法黑客松)', sort_order: 2 },
      { title: '创意策划与大型活动方向 (科技沙龙/创客黑客松/破冰)', sort_order: 3 },
      { title: '融媒宣传与品牌运营方向 (摄影/设计/推文/视频/新媒体)', sort_order: 4 },
      { title: '综合组织与实践外联方向 (社员档案/物资保障/企业赞助)', sort_order: 5 }
    ];

    for (const d of defaultDirections) {
      await pool.query('INSERT INTO development_directions (title, sort_order, is_active) VALUES (?, ?, 1)', [d.title, d.sort_order]);
    }
  }

  // 10. 初始化活动类别 (activity_categories)
  const [catCount] = await pool.query('SELECT COUNT(*) as count FROM activity_categories');
  if (catCount[0].count === 0) {
    const defaultCategories = [
      { title: '技术沙龙 (工作坊/讲座/实战)', sort_order: 1 },
      { title: '创客黑客松 (马拉松比赛/Demo秀)', sort_order: 2 },
      { title: '破冰团建 (交流会/联谊/户外桌游)', sort_order: 3 },
      { title: '名企参访 (行业实地观摩)', sort_order: 4 },
      { title: '竞赛培训 (挑战杯/互联网+/算法)', sort_order: 5 }
    ];

    for (const c of defaultCategories) {
      await pool.query('INSERT INTO activity_categories (title, sort_order, is_active) VALUES (?, ?, 1)', [c.title, c.sort_order]);
    }
  }
}

// 统一异步查询适配器
async function query(sql, params = []) {
  if (isMySQL && pool) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }
  return sqliteQuery(sql, params);
}

async function getOne(sql, params = []) {
  if (isMySQL && pool) {
    const [rows] = await pool.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
  return sqliteGetOne(sql, params);
}

async function execute(sql, params = []) {
  if (isMySQL && pool) {
    const [result] = await pool.query(sql, params);
    return {
      lastInsertRowid: result.insertId,
      changes: result.affectedRows
    };
  }
  return sqliteExecute(sql, params);
}

// ---------------- SQLite 应急备用引擎 ----------------
function initFallbackSQLite() {
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  sqliteDb = new DatabaseSync(path.join(dbDir, 'campus_club.db'));

  // 确保基础表存在
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      college TEXT NOT NULL,
      className TEXT NOT NULL,
      qq TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portal_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      club_name TEXT NOT NULL,
      hero_badge TEXT,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT,
      about_title TEXT NOT NULL,
      about_content TEXT NOT NULL,
      stats_json TEXT NOT NULL,
      departments_json TEXT NOT NULL,
      contact_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS club_documents (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER DEFAULT 0,
      uploaded_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS application_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS membership_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      college TEXT NOT NULL,
      className TEXT NOT NULL,
      qq TEXT NOT NULL,
      email TEXT NOT NULL,
      target_dept TEXT,
      statement TEXT,
      submission_filename TEXT,
      submission_filepath TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_id INTEGER,
      reviewer_name TEXT,
      review_notes TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'public',
      tag TEXT DEFAULT '通知',
      author_id INTEGER,
      author_name TEXT,
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mail_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      to_name TEXT,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      path TEXT NOT NULL,
      is_system INTEGER DEFAULT 0,
      is_nav_visible INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      seo_description TEXT,
      content TEXT,
      content_html TEXT,
      template_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS member_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_college TEXT,
      content TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      admin_reply TEXT,
      reply_admin_id INTEGER,
      reply_admin_name TEXT,
      replied_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      creator_name TEXT NOT NULL,
      creator_role TEXT NOT NULL,
      creator_college TEXT,
      title TEXT NOT NULL,
      category TEXT DEFAULT '技术沙龙',
      expected_time TEXT,
      expected_location TEXT,
      budget TEXT,
      description TEXT,
      details TEXT NOT NULL,
      status TEXT DEFAULT 'voting',
      vote_count INTEGER DEFAULT 0,
      admin_decision_notes TEXT,
      decided_by INTEGER,
      decided_admin_name TEXT,
      decided_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS proposal_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (proposal_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS development_directions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS role_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      current_role TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'admin',
      target_direction TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewer_id INTEGER,
      review_notes TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    sqliteDb.exec('ALTER TABLE site_pages ADD COLUMN content_html TEXT');
  } catch (error) {
    if (!/duplicate column name|already exists/i.test(error.message)) throw error;
  }
  try {
    sqliteDb.exec('ALTER TABLE site_pages ADD COLUMN template_config TEXT');
  } catch (error) {
    if (!/duplicate column name|already exists/i.test(error.message)) throw error;
  }

  sqliteDb.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)').run('registration_limit', '1000');

  const corePages = [
    ['首页', 'home', '/', 1, '高校社团官方主页', ''],
    ['关于我们', 'about', '/about', 2, '社团发展历程、文化理念与荣誉介绍', ''],
    ['纳新通道', 'recruitment', '/recruitment', 3, '社团招新申请与报名通道', ''],
    ['通知公告', 'notices', '/notices', 4, '社团公开通知和成员公告', ''],
    ['联系方式', 'contact', '/contact', 5, '社团联系方式与在线咨询', '']
  ];
  const insertCorePage = sqliteDb.prepare(`
    INSERT OR IGNORE INTO site_pages
      (title, slug, path, is_system, is_nav_visible, sort_order, seo_description, content, content_html, template_config)
    VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, NULL)
  `);
  for (const page of corePages) {
    insertCorePage.run(page[0], page[1], page[2], page[3], page[4], page[4], page[5]);
  }

  // 为 SQLite 应急引擎预置 5 个默认发展方向
  const dirCount = sqliteDb.prepare('SELECT COUNT(*) as c FROM development_directions').get();
  if (!dirCount || dirCount.c === 0) {
    const dirs = [
      { title: '前沿全栈与AI研发方向 (Web/AI/嵌入式/云原生)', sort_order: 1 },
      { title: '高水平科技竞赛方向 (中国国际创新大赛/挑战杯/算法黑客松)', sort_order: 2 },
      { title: '创意策划与大型活动方向 (科技沙龙/创客黑客松/破冰)', sort_order: 3 },
      { title: '融媒宣传与品牌运营方向 (摄影/设计/推文/视频/新媒体)', sort_order: 4 },
      { title: '综合组织与实践外联方向 (社员档案/物资保障/企业赞助)', sort_order: 5 }
    ];
    const insertStmt = sqliteDb.prepare('INSERT INTO development_directions (title, sort_order, is_active) VALUES (?, ?, 1)');
    for (const d of dirs) {
      insertStmt.run(d.title, d.sort_order);
    }
  }

  const catCount = sqliteDb.prepare('SELECT COUNT(*) as c FROM activity_categories').get();
  if (!catCount || catCount.c === 0) {
    const cats = [
      { title: '技术沙龙 (工作坊/讲座/实战)', sort_order: 1 },
      { title: '创客黑客松 (马拉松比赛/Demo秀)', sort_order: 2 },
      { title: '破冰团建 (交流会/联谊/户外桌游)', sort_order: 3 },
      { title: '名企参访 (行业实地观摩)', sort_order: 4 },
      { title: '竞赛培训 (挑战杯/互联网+/算法)', sort_order: 5 }
    ];
    const insertCat = sqliteDb.prepare('INSERT INTO activity_categories (title, sort_order, is_active) VALUES (?, ?, 1)');
    for (const c of cats) {
      insertCat.run(c.title, c.sort_order);
    }
  }
}

function sqliteQuery(sql, params = []) {
  if (!sqliteDb) initFallbackSQLite();
  // 替换反引号为标准标识符
  const cleanSql = sql.replace(/`key`/g, 'key').replace(/`value`/g, 'value');
  const stmt = sqliteDb.prepare(cleanSql);
  return stmt.all(...params);
}

function sqliteGetOne(sql, params = []) {
  if (!sqliteDb) initFallbackSQLite();
  const cleanSql = sql.replace(/`key`/g, 'key').replace(/`value`/g, 'value');
  const stmt = sqliteDb.prepare(cleanSql);
  return stmt.get(...params) || null;
}

function sqliteExecute(sql, params = []) {
  if (!sqliteDb) initFallbackSQLite();
  const cleanSql = sql.replace(/`key`/g, 'key').replace(/`value`/g, 'value');
  const stmt = sqliteDb.prepare(cleanSql);
  const info = stmt.run(...params);
  return {
    lastInsertRowid: Number(info.lastInsertRowid),
    changes: info.changes
  };
}

async function cleanupReviewedSubmissions() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoffValue = cutoff.toISOString().slice(0, 19).replace('T', ' ');
  const expired = await query(`
    SELECT id, submission_filepath, submission_filename
    FROM membership_applications
    WHERE status IN ('approved', 'rejected')
      AND reviewed_at IS NOT NULL
      AND reviewed_at <= ?
      AND (submission_filepath IS NOT NULL OR submission_filename IS NOT NULL)
  `, [cutoffValue]);

  let cleaned = 0;
  for (const application of expired) {
    const candidates = [
      application.submission_filepath,
      application.submission_filepath ? path.join(submissionsDir, path.basename(application.submission_filepath)) : null,
      application.submission_filename ? path.join(submissionsDir, application.submission_filename) : null
    ].filter(Boolean);

    for (const filePath of new Set(candidates)) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (error) { console.warn('[Cleanup] 删除申请附件失败:', error.message); }
      }
    }

    await execute(`
      UPDATE membership_applications
      SET submission_filepath = NULL, submission_filename = NULL
      WHERE id = ?
    `, [application.id]);
    cleaned += 1;
  }

  if (cleaned > 0) console.log(`[Cleanup] 已自动清理 ${cleaned} 份超过 1 天的已审阅申请附件`);
  return cleaned;
}

module.exports = {
  initDatabase,
  query,
  getOne,
  execute,
  uploadsDir,
  templatesDir,
  submissionsDir,
  clubFilesDir,
  cleanupReviewedSubmissions
};