const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getOne, execute, clubFilesDir } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

function decodeUploadFilename(filename) {
  if (!filename) return '';
  if (!/[\u00c0-\u00ff]/.test(filename)) return filename;
  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? filename : decoded;
}

const aboutFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, clubFilesDir),
  filename: (req, file, cb) => {
    const originalName = decodeUploadFilename(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    cb(null, `club-introduction_${Date.now()}${ext}`);
  }
});

const uploadAboutFile = multer({
  storage: aboutFileStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('社团介绍文件仅支持 PDF、Word、TXT 或 Markdown 格式'), allowed.includes(ext));
  },
  limits: { fileSize: 30 * 1024 * 1024 }
});

router.get('/about-document', async (req, res) => {
  try {
    const document = await getOne('SELECT * FROM club_documents WHERE id = 1');
    if (!document) return res.status(404).json({ success: false, message: '管理员尚未上传社团介绍文件' });

    let filePath = document.filepath;
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = path.join(clubFilesDir, document.filename);
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '社团介绍文件不存在或已被移除' });

    res.download(filePath, decodeUploadFilename(document.filename));
  } catch (error) {
    console.error('Download club document error:', error);
    res.status(500).json({ success: false, message: '下载社团介绍文件失败' });
  }
});

router.get('/about-document/info', async (req, res) => {
  try {
    const document = await getOne('SELECT id, title, filename, mime_type, size, updated_at FROM club_documents WHERE id = 1');
    if (document) {
      document.title = decodeUploadFilename(document.title);
      document.filename = decodeUploadFilename(document.filename);
    }
    res.json({ success: true, data: document || null });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取社团介绍文件信息失败' });
  }
});

router.post('/about-document', authenticateToken, requireRole(['admin', 'super_admin']), uploadAboutFile.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择要上传的社团介绍文件' });

    const oldDocument = await getOne('SELECT filepath, filename FROM club_documents WHERE id = 1');
    const originalName = decodeUploadFilename(req.file.originalname);
    const title = decodeUploadFilename(req.body.title || originalName).trim();
    const documentParams = [title, originalName, req.file.path, req.file.mimetype, req.file.size, req.user.id];
    if (oldDocument) {
      await execute(`
        UPDATE club_documents
        SET title = ?, filename = ?, filepath = ?, mime_type = ?, size = ?, uploaded_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, documentParams);
    } else {
      await execute(`
        INSERT INTO club_documents (id, title, filename, filepath, mime_type, size, uploaded_by)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `, documentParams);
    }

    if (oldDocument) {
      const oldPath = oldDocument.filepath && fs.existsSync(oldDocument.filepath)
        ? oldDocument.filepath
        : path.join(clubFilesDir, oldDocument.filename || '');
      if (oldPath && fs.existsSync(oldPath) && oldPath !== req.file.path) fs.unlinkSync(oldPath);
    }

    res.status(201).json({ success: true, message: '社团介绍文件上传成功', data: { title, filename: originalName, size: req.file.size } });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Upload club document error:', error);
    res.status(500).json({ success: false, message: '上传社团介绍文件失败: ' + error.message });
  }
});

router.delete('/about-document', authenticateToken, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const document = await getOne('SELECT filepath, filename FROM club_documents WHERE id = 1');
    if (!document) return res.status(404).json({ success: false, message: '暂无社团介绍文件' });
    const filePath = document.filepath && fs.existsSync(document.filepath)
      ? document.filepath
      : path.join(clubFilesDir, document.filename || '');
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await execute('DELETE FROM club_documents WHERE id = 1');
    res.json({ success: true, message: '社团介绍文件已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除社团介绍文件失败' });
  }
});

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
