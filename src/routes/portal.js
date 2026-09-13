const express = require('express');
const router = express.Router();
const { getOne, execute } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 获取官网前台展示配置 (公开接口)
router.get('/config', async (req, res) => {
  try {
    const config = await getOne('SELECT * FROM portal_config WHERE id = 1');
    if (!config) {
      return res.status(404).json({ success: false, message: '官网主页配置未找到' });
    }

    const safeParse = (val, fallback) => {
      if (typeof val === 'object' && val !== null) return val;
      try {
        return JSON.parse(val || JSON.stringify(fallback));
      } catch (e) {
        return fallback;
      }
    };

    const parsedConfig = {
      ...config,
      stats: safeParse(config.stats_json, []),
      departments: safeParse(config.departments_json, []),
      contact: safeParse(config.contact_json, {})
    };

    res.json({
      success: true,
      data: parsedConfig
    });
  } catch (error) {
    console.error('Fetch portal config error:', error);
    res.status(500).json({ success: false, message: '获取官网配置失败: ' + error.message });
  }
});

// 管理员/超级管理员更新官网配置
router.put('/config', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const {
      club_name,
      hero_badge,
      hero_title,
      hero_subtitle,
      about_title,
      about_content,
      stats,
      departments,
      contact
    } = req.body;

    if (!club_name || !hero_title || !about_content) {
      return res.status(400).json({ success: false, message: '社团名称、主页标语与关于简介不可为空' });
    }

    const stats_json = typeof stats === 'string' ? stats : JSON.stringify(stats || []);

    // 部门设置已在后台移除编辑入口：未传 departments 时保留数据库原值，避免误清空前台部门展示
    let departments_json;
    if (departments === undefined) {
      const existing = await getOne('SELECT departments_json FROM portal_config WHERE id = 1');
      departments_json = existing ? existing.departments_json : '[]';
    } else {
      departments_json = typeof departments === 'string' ? departments : JSON.stringify(departments || []);
    }

    const contact_json = typeof contact === 'string' ? contact : JSON.stringify(contact || {});

    await execute(`
      UPDATE portal_config
      SET club_name = ?, hero_badge = ?, hero_title = ?, hero_subtitle = ?,
          about_title = ?, about_content = ?, stats_json = ?, departments_json = ?,
          contact_json = ?
      WHERE id = 1
    `, [
      club_name.trim(),
      hero_badge || '',
      hero_title.trim(),
      hero_subtitle || '',
      about_title.trim(),
      about_content.trim(),
      stats_json,
      departments_json,
      contact_json
    ]);

    res.json({
      success: true,
      message: '官网首页展示内容已即时同步更新！'
    });
  } catch (error) {
    console.error('Update portal config error:', error);
    res.status(500).json({ success: false, message: '更新官网配置失败: ' + error.message });
  }
});

module.exports = router;
