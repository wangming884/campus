const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getOne, execute } = require('../db/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

// 注册接口 (统一默认成为「普通用户」)
router.post('/register', async (req, res) => {
  try {
    const { name, college, className, qq, email, password } = req.body;

    if (!name || !college || !className || !qq || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '请完整填写注册信息（姓名、学院、班级、QQ号、邮箱与密码）'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: '请输入有效的邮箱地址' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度至少为 6 位' });
    }

    // 检查邮箱是否已注册
    const existing = await getOne('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册，请直接登录' });
    }

    // 密码哈希
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // 严格设定新注册用户角色为普通用户 (user)
    const result = await execute(`
      INSERT INTO users (name, college, className, qq, email, password, role)
      VALUES (?, ?, ?, ?, ?, ?, 'user')
    `, [name.trim(), college.trim(), className.trim(), qq.trim(), email.trim(), hash]);

    const newUser = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: email.trim(),
      college: college.trim(),
      className: className.trim(),
      qq: qq.trim(),
      role: 'user'
    };

    const token = generateToken(newUser);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 3600 * 1000,
      sameSite: 'lax'
    });

    res.status(201).json({
      success: true,
      message: '注册成功，当前角色为【普通用户】。可在招新专区下载申请表模板并提交入社申请！',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: '注册失败: ' + error.message });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '请输入邮箱和密码' });
    }

    const user = await getOne('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      college: user.college,
      className: user.className,
      qq: user.qq,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 3600 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: `欢迎回来，${safeUser.name}！`,
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: '登录失败: ' + error.message });
  }
});

// 退出登录接口 (清理 Cookie)
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: '已成功退出登录' });
});

// 获取当前登录用户信息
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// 更新个人基本信息
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, college, className, qq } = req.body;
    if (!name || !college || !className || !qq) {
      return res.status(400).json({ success: false, message: '请完整提供姓名、学院、班级及QQ号' });
    }

    await execute(`
      UPDATE users 
      SET name = ?, college = ?, className = ?, qq = ?
      WHERE id = ?
    `, [name.trim(), college.trim(), className.trim(), qq.trim(), req.user.id]);

    const updatedUser = await getOne('SELECT id, name, email, college, className, qq, role, created_at FROM users WHERE id = ?', [req.user.id]);

    res.json({
      success: true,
      message: '个人信息更新成功',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: '更新失败: ' + error.message });
  }
});

module.exports = router;
