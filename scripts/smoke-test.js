/**
 * 轻量冒烟测试（零依赖，可直接接入 CI）
 *
 * 覆盖三类最容易"静默翻车"的问题：
 *   1. 语法错误（vm 编译每个源文件）
 *   2. 使用了工具函数却没有 require（此前 dailyIdeas.js 的 fixMojibake 即此类）
 *   3. 路由模块未能正确导出 Express Router
 *
 * 不连接数据库、不启动 HTTP 服务，可安全在任意环境执行。
 * 运行：npm test
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const failures = [];

// 项目中跨文件复用的工具/中间件函数名，用于检测"漏 import"
const SHARED_HELPERS = [
  'fixMojibake',
  'isWordDocument',
  'getExpectedPdfPath',
  'convertWordToPdf',
  'getConverterStatus',
  'invalidateCache',
  'buildExcelXml',
  'buildCsvWithBom',
  'sendEmail',
  'sendAdmissionEmail',
  'sendRejectionEmail',
  'getMailSettings',
  'generateToken',
  'authenticateToken',
  'optionalAuth',
  'requireRole',
  'buildCookieOptions',
  'withTransaction'
];

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      result.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      result.push(full);
    }
  }
  return result;
}

function collectBoundNames(source) {
  const names = new Set();

  const requireRe = /(?:const|let|var)\s+([^=;]+?)\s*=\s*require\s*\(/g;
  let match;
  while ((match = requireRe.exec(source)) !== null) {
    const lhs = match[1];
    const destructured = lhs.match(/\{([\s\S]*?)\}/);
    if (destructured) {
      for (const part of destructured[1].split(',')) {
        const name = part.split(':').pop().trim();
        if (name) names.add(name);
      }
    } else {
      const name = lhs.trim();
      if (name) names.add(name);
    }
  }

  const declRe = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/g;
  while ((match = declRe.exec(source)) !== null) {
    names.add(match[1] || match[2]);
  }

  return names;
}

const sourceFiles = [
  path.join(ROOT, 'server.js'),
  ...walk(path.join(ROOT, 'src')),
  ...walk(path.join(ROOT, 'scripts')).filter(file => !file.endsWith('smoke-test.js'))
];

// 1 + 2：语法与漏 import 检查
for (const file of sourceFiles) {
  const relative = path.relative(ROOT, file);
  const source = fs.readFileSync(file, 'utf8');

  try {
    new vm.Script(source, { filename: file });
  } catch (error) {
    failures.push(`[语法错误] ${relative}: ${error.message}`);
    continue;
  }

  const bound = collectBoundNames(source);
  for (const helper of SHARED_HELPERS) {
    if (!new RegExp(`\\b${helper}\\b`).test(source)) continue;
    if (!bound.has(helper)) {
      failures.push(`[漏导入] ${relative}: 使用了 ${helper}()，但未 require 或定义`);
    }
  }
}

// 3：路由模块必须导出可用的 Router
const routesDir = path.join(ROOT, 'src', 'routes');
for (const file of fs.readdirSync(routesDir).filter(name => name.endsWith('.js'))) {
  const relative = path.join('src', 'routes', file);
  try {
    const router = require(path.join(routesDir, file));
    if (typeof router !== 'function' || typeof router.use !== 'function') {
      failures.push(`[路由导出] ${relative}: 未导出 Express Router`);
    }
  } catch (error) {
    failures.push(`[加载失败] ${relative}: ${error.message}`);
  }
}

// 4：核心模块可正常加载并导出预期方法
for (const modulePath of ['src/db/database.js', 'src/middleware/auth.js', 'src/services/pageRenderer.js']) {
  try {
    const mod = require(path.join(ROOT, modulePath));
    if (!mod || typeof mod !== 'object') {
      failures.push(`[模块导出] ${modulePath}: 导出内容异常`);
    }
  } catch (error) {
    failures.push(`[加载失败] ${modulePath}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`\n❌ 冒烟测试未通过，共 ${failures.length} 项：`);
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}

console.log(`✅ 冒烟测试通过：${sourceFiles.length} 个源文件语法正常，路由与核心模块加载正常。`);
