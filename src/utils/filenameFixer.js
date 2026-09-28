/**
 * 文件名与中文编码修复工具
 * 解决浏览器、Multer/Busboy 或历史数据库将 UTF-8 多字节解析为 Windows-1252 (CP1252) 或 ISO-8859-1 导致的中文乱码
 */

// Windows-1252 (CP1252) 0x80 - 0x9F 与 Unicode 对应映射表
const cp1252Map = new Map([
  [0x20ac, 0x80], // €
  [0x201a, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02c6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8a], // Š
  [0x2039, 0x8b], // ‹
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9a], // š
  [0x203a, 0x9b], // ›
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e], // ž
  [0x0178, 0x9f]  // Ÿ
]);

/**
 * 修复可能存在 Windows-1252 / ISO-8859-1 乱码的文件名或字符串
 * @param {string} str 待检测与修复的字符串
 * @returns {string} 修复后的正确 UTF-8 字符串
 */
function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str || '';

  // 1. 优先尝试处理 URL / Percent 编码 (如 %E6%8B%9B...)
  if (str.includes('%')) {
    try {
      const uriDecoded = decodeURIComponent(str);
      if (uriDecoded !== str && /[\u4e00-\u9fa5]/.test(uriDecoded)) {
        return uriDecoded;
      }
    } catch (e) {}
  }

  // 2. 检测是否包含典型的 Latin-1 (0x80-0xFF) 或 CP1252 替换字符
  const hasMojibakeChars = /[\u0080-\u00ff\u0152\u0153\u0160\u0161\u017d\u017e\u0178\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/.test(str);
  if (!hasMojibakeChars) {
    return str;
  }

  // 3. 尝试将 CP1252 / Latin-1 Unicode 字符还原为原始字节并按 UTF-8 重新解析
  try {
    const bytes = [];
    let valid = true;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (cp1252Map.has(code)) {
        bytes.push(cp1252Map.get(code));
      } else if (code <= 0xff) {
        bytes.push(code);
      } else {
        valid = false;
        break;
      }
    }
    if (valid && bytes.length > 0) {
      const decoded = Buffer.from(bytes).toString('utf8');
      if (!decoded.includes('\ufffd') && /[\u4e00-\u9fa5]/.test(decoded)) {
        return decoded;
      }
    }
  } catch (e) {}

  // 4. 标准 Latin-1 回退尝试
  try {
    const decoded = Buffer.from(str, 'latin1').toString('utf8');
    if (!decoded.includes('\ufffd') && /[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
  } catch (e) {}

  return str;
}

module.exports = {
  fixMojibake
};
