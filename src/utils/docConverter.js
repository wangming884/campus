const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

/**
 * 常见系统环境中 LibreOffice / soffice 可执行文件路径
 */
const CANDIDATE_PATHS = [
  process.env.LIBREOFFICE_PATH,
  process.env.SOFFICE_PATH,
  '/usr/bin/libreoffice',
  '/usr/bin/soffice',
  '/usr/local/bin/libreoffice',
  '/usr/local/bin/soffice',
  'libreoffice',
  'soffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
].filter(Boolean);

let cachedBinaryPath = null;
let lastCheckTime = 0;

/**
 * 检测系统中可用的 LibreOffice / soffice 转换组件
 */
async function detectLibreOffice() {
  const now = Date.now();
  if (cachedBinaryPath && (now - lastCheckTime < 120000)) {
    return cachedBinaryPath;
  }

  for (const bin of CANDIDATE_PATHS) {
    if (bin.includes('/') || bin.includes('\\')) {
      if (fs.existsSync(bin)) {
        cachedBinaryPath = bin;
        lastCheckTime = now;
        return bin;
      }
    } else {
      // 检查环境变量 PATH 中的可执行程序
      const isAvailable = await new Promise((resolve) => {
        try {
          execFile(bin, ['--version'], { timeout: 3000 }, (error) => {
            resolve(!error);
          });
        } catch (e) {
          resolve(false);
        }
      });
      if (isAvailable) {
        cachedBinaryPath = bin;
        lastCheckTime = now;
        return bin;
      }
    }
  }

  return null;
}

/**
 * 判断是否为支持转换的 Word 文档 (.doc 或 .docx)
 */
function isWordDocument(filePath) {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.doc' || ext === '.docx';
}

/**
 * 计算预期的目标 PDF 文件路径
 */
function getExpectedPdfPath(inputFilePath, outputDir) {
  if (!inputFilePath) return null;
  const targetDir = outputDir || path.dirname(inputFilePath);
  const ext = path.extname(inputFilePath);
  return path.join(targetDir, path.basename(inputFilePath, ext) + '.pdf');
}

/**
 * 执行 Word (.doc/.docx) 转 PDF
 * @param {string} inputFilePath Word 文件绝对路径
 * @param {string} [outputDir] 可选输出目录，默认与输入文件相同目录
 * @returns {Promise<{ success: boolean, pdfPath?: string, cached?: boolean, error?: string, code?: string }>}
 */
async function convertWordToPdf(inputFilePath, outputDir) {
  if (!inputFilePath || !fs.existsSync(inputFilePath)) {
    return {
      success: false,
      error: '源 Word 文件不存在或已被移除',
      code: 'FILE_NOT_FOUND'
    };
  }

  if (!isWordDocument(inputFilePath)) {
    return {
      success: false,
      error: '仅支持转换 .doc 与 .docx 格式的 Word 文档',
      code: 'UNSUPPORTED_FORMAT'
    };
  }

  const targetDir = outputDir || path.dirname(inputFilePath);
  const expectedPdfPath = getExpectedPdfPath(inputFilePath, targetDir);

  // 1. 若同名 PDF 已存在且修改时间不早于原文档，直接复用缓存
  if (fs.existsSync(expectedPdfPath)) {
    try {
      const srcStat = fs.statSync(inputFilePath);
      const pdfStat = fs.statSync(expectedPdfPath);
      if (pdfStat.size > 0 && pdfStat.mtime >= srcStat.mtime) {
        return {
          success: true,
          pdfPath: expectedPdfPath,
          cached: true
        };
      }
    } catch (e) {
      // stat 异常时继续尝试重新生成
    }
  }

  // 2. 探测 Linux / 云服务器环境中的 LibreOffice
  const bin = await detectLibreOffice();
  if (!bin) {
    const installTips = process.platform === 'win32'
      ? 'Windows 环境可安装 LibreOffice (https://zh-cn.libreoffice.org/download/libreoffice/) 即可启用本地转换。'
      : '云端 Linux 服务器尚未安装 LibreOffice 转换工具。可在服务器执行: \n' +
        '  - Ubuntu / Debian: sudo apt-get update && sudo apt-get install -y libreoffice fonts-wqy-zenhei\n' +
        '  - CentOS / RHEL / 阿里云: sudo yum install -y libreoffice wqy-zenhei-fonts\n' +
        '  - Docker 环境: 请确保 Dockerfile 中包含 libreoffice 和中文字体包';

    return {
      success: false,
      error: '未检测到 LibreOffice 转换引擎。' + installTips,
      code: 'CONVERTER_NOT_FOUND'
    };
  }

  // 3. 调用 LibreOffice 无头模式进行转换
  return new Promise((resolve) => {
    const args = [
      '--headless',
      '--invisible',
      '--nologo',
      '--nodefault',
      '--norestore',
      '-env:UserInstallation=file:///tmp/libreoffice_profile',
      '--convert-to',
      'pdf',
      '--outdir',
      targetDir,
      inputFilePath
    ];

    try {
      execFile(bin, args, { timeout: 45000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[DocConverter] LibreOffice 转换执行失败:', error.message, stderr);
          return resolve({
            success: false,
            error: '文档转 PDF 失败: ' + (error.message || stderr || '转换进程异常退出'),
            code: 'CONVERSION_FAILED',
            details: stderr || stdout
          });
        }

        if (fs.existsSync(expectedPdfPath) && fs.statSync(expectedPdfPath).size > 0) {
          console.log('[DocConverter] ✅ 成功转换 Word 为 PDF:', expectedPdfPath);
          return resolve({
            success: true,
            pdfPath: expectedPdfPath
          });
        }

        resolve({
          success: false,
          error: 'LibreOffice 进程已退出，但在目标路径未检测到生成的 PDF 文件',
          code: 'OUTPUT_MISSING'
        });
      });
    } catch (err) {
      resolve({
        success: false,
        error: '启动转换进程失败: ' + err.message,
        code: 'SPAWN_ERROR'
      });
    }
  });
}

/**
 * 获取当前环境转换器状态与安装指引
 */
async function getConverterStatus() {
  const bin = await detectLibreOffice();
  return {
    available: !!bin,
    engine: bin ? 'libreoffice' : null,
    binaryPath: bin || null,
    platform: process.platform,
    installGuide: {
      debian_ubuntu: 'sudo apt-get update && sudo apt-get install -y libreoffice fonts-wqy-zenhei fonts-wqy-microhei',
      centos_alilinux: 'sudo yum install -y libreoffice wqy-zenhei-fonts',
      alpine_docker: 'apk add --no-cache libreoffice font-wqy-zenhei font-noto-cjk'
    }
  };
}

module.exports = {
  isWordDocument,
  getExpectedPdfPath,
  convertWordToPdf,
  getConverterStatus
};
