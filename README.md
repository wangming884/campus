# 高校社团官网与管理系统

面向高校学生社团的一体化 Web 应用：**对外是官网门户，对内是社员管理系统**。涵盖招新宣传、在线报名、申请审核、社员分组、每日一设、活动提案投票、留言互动与邮件通知。

![Node](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933)
![Express](https://img.shields.io/badge/Express-5.x-000000)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [架构说明](#架构说明)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [目录结构](#目录结构)
- [数据模型](#数据模型)
- [API 概览](#api-概览)
- [角色与权限](#角色与权限)
- [生产部署](#生产部署)
- [开发与测试](#开发与测试)
- [常见问题](#常见问题)
- [安全须知](#安全须知)

---

## 功能特性

### 对外门户

| 页面 | 路由 | 说明 |
|---|---|---|
| 首页 | `/` | Hero 区、社团数据、部门介绍、最新公告 |
| 关于我们 | `/about` | 社团简介、发展里程碑、荣誉墙、社团介绍文件下载 |
| 纳新通道 | `/recruitment` | 申请表模板下载、在线提交报名、进度查询 |
| 通知公告 | `/notices` | 公开通知 + 成员专享通知（按角色过滤） |
| 联系方式 | `/contact` | 地址、邮箱、QQ 群、公众号 |
| 自定义页面 | `/page/:slug` | 后台可视化创建，支持富文本 / HTML |

所有页面均为**服务端直出（SSR）**：后台改文案后前台立即生效，无内容跳变（FOUC）。

### 账号体系

- 邮箱验证码注册（6 位码，10 分钟有效，SHA-256 存库）
- JWT 登录（7 天有效），HttpOnly Cookie 与 Bearer Token 双通道
- bcrypt 密码哈希、个人资料维护、修改密码
- 注册人数上限可配置（默认 1000）

### 招新管理

- 管理员上传 / 切换 / 删除申请表模板（Word、PDF、Excel）
- 用户上传填写好的申请表，**Word 自动转 PDF** 供在线预览
- 审核通过自动升级为「社团成员」并发送录取邮件，驳回发送反馈邮件
- 报名数据一键导出 Excel / CSV（含筛选条件）
- 附件下载权限校验（本人或管理员）

### 社员运营

- **每日一设**：成员提交设想（可带附件），按小组归集，管理员 / 组长评阅并标记优秀
- **活动提案**：成员发起提案，全员投票，管理员决策是否举办
- **留言板**：成员发帖、管理员回复、置顶
- **小组管理**：管理员作为组长管理成员，超管可查看全部小组
- **角色申请**：成员可申请晋升管理员，超管审批

### 内容与系统管理

- 门户配置（社团名称、Hero 文案、统计数据、部门、联系方式）
- 页面管理（新增 / 编辑 / 隐藏自定义页面，配置 SEO 与模板字段）
- 公告发布、提案管理、留言管理、用户管理、方向 / 分类字典
- 邮件配置（SMTP）与发信日志，支持**模拟发信模式**（无需真实 SMTP 即可跑通全流程）
- 接口限流、附件定期清理、历史中文乱码自愈

---

## 技术栈

| 分类 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 22.5（CommonJS） |
| Web 框架 | Express 5 |
| 数据库 | MySQL 8（主）/ SQLite（`node:sqlite` 兜底） |
| 认证 | jsonwebtoken + bcryptjs + cookie-parser |
| 文件上传 | multer（磁盘存储，扩展名白名单，20–30MB 限制） |
| 文档转换 | LibreOffice 无头模式（Word → PDF） |
| 邮件 | nodemailer（SMTP / 模拟模式） |
| 表格导出 | 自研 Excel XML + CSV（带 BOM，无额外依赖） |
| 前端 | 原生 HTML / CSS / JavaScript，多页应用，无构建步骤 |

---

## 架构说明

```
浏览器（多页 HTML + 5 个全局 JS）
        │
        ├── GET / /about /recruitment /notices /contact /page/:slug
        │        └─ pageRenderer：读取 public/*.html，按 data-cms-field
        │           正则注入后直出，并在 </head> 注入 window.__INITIAL_DATA__
        │
        └── /api/*（13 个路由模块）
                 └─ 安全响应头 → 全局限流 → JWT 鉴权 → 角色校验 → 业务逻辑
                          ├─ MySQL 8（连接池）/ SQLite（降级）
                          ├─ uploads/（模板、申请、设想附件）
                          ├─ LibreOffice（Word 转 PDF）
                          └─ SMTP（录取 / 驳回 / 通知邮件）
```

**页面渲染机制**：`src/services/pageRenderer.js` 把 HTML 当作字符串模板，通过 `data-cms-field`（文本字段）、`data-cms-section`（区块显隐）和元素 `id` 定位替换；数据同时以 `window.__INITIAL_DATA__` 注入前端，避免二次请求造成闪烁。缓存 TTL 30 秒，后台写操作会主动失效缓存。

---

## 快速开始

### 环境要求

- Node.js **≥ 22.5**（SQLite 兜底依赖内置 `node:sqlite`）
- MySQL 8（可选，若使用 SQLite 模式则不需要）
- LibreOffice（可选，用于 Word 在线预览）

### 方式一：MySQL（推荐）

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env        # Windows: copy .env.example .env

# 3. 生成 JWT 密钥并填入 .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. 启动
npm start
```

首次启动会自动建库、建表、写入默认站点配置与种子数据（数据库账号需有建库权限）。访问地址取决于 `PORT`：代码默认为 <http://localhost:3000>，`.env.example` 示例中为 `5624`。

### 方式二：SQLite（零依赖，适合本地开发 / 演示）

```bash
USE_SQLITE=true npm start     # Windows PowerShell: $env:USE_SQLITE="true"; npm start
```

数据文件位于 `data/campus_club.db`，无需安装 MySQL。

### 方式三：Docker

```bash
# 开发模式（挂载源码，映射 3000 端口）
docker compose up -d --build

# 生产模式（使用镜像，映射 5624 端口）
docker compose -f docker-compose.prod.yml up -d
```

> Docker 镜像基于 `node:22-alpine`，已内置 LibreOffice 与中文字体（文泉驿正黑），支持 Word 转 PDF。

### 首次登录

| 项目 | 值 |
|---|---|
| 后台地址 | `/admin` |
| 个人中心 | `/profile` |
| 超管账号 | `superadmin@campus.club` |
| 超管密码 | 由 `ADMIN_INITIAL_PASSWORD` 指定；未指定则随机生成，**仅在首次创建时打印到控制台** |

登录后请立即在个人中心修改密码。

---

## 环境变量

复制 `.env.example` 后按需填写：

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `PORT` | 否 | `3000` | 服务监听端口 |
| `USE_SQLITE` | 否 | `false` | `true` 时跳过 MySQL，直接使用 SQLite |
| `DB_HOST` | 否 | `localhost` | MySQL 主机 |
| `DB_PORT` | 否 | `3307`（代码）/ `3306`（示例） | MySQL 端口，请与实际一致 |
| `DB_USER` | 否 | `root` | MySQL 用户 |
| `DB_PASSWORD` | 是 | — | MySQL 密码 |
| `DB_NAME` | 否 | `campus_club` | 数据库名，不存在会自动创建 |
| `JWT_SECRET` | **是** | — | JWT 签名密钥，建议 ≥ 32 位随机字符串；缺失时服务拒绝启动 |
| `ADMIN_INITIAL_PASSWORD` | 否 | 随机 | 首次初始化超管时使用的密码 |
| `ATTACHMENT_RETENTION_DAYS` | 否 | `30` | 已审核申请附件的保留天数，`<= 0` 关闭自动清理 |
| `TRUST_PROXY` | 否 | 空 | 部署在 Nginx / 负载均衡后设为 `1`，否则不信任 `X-Forwarded-For` |
| `CORS_ORIGINS` | 否 | 空 | 跨域白名单，逗号分隔；留空则仅同源可用 |
| `COOKIE_SECURE` | 否 | `false` | 全站 HTTPS 时设为 `true` |
| `LIBREOFFICE_PATH` | 否 | 自动探测 | 自定义 `soffice` 可执行文件路径 |

---

## 目录结构

```
campus/
├── server.js                  # 应用入口：中间件、路由注册、页面直出、启动流程
├── src/
│   ├── db/
│   │   └── database.js        # 连接池、双引擎建表、种子数据、事务、清理任务
│   ├── middleware/
│   │   ├── auth.js            # JWT 签发/校验、角色层级鉴权、Cookie 配置
│   │   └── rateLimiter.js     # 零依赖内存限流（全局/验证码/登录/提交/留言）
│   ├── routes/                # 13 个业务路由模块
│   │   ├── auth.js            # 注册、登录、改密、个人资料
│   │   ├── portal.js          # 门户配置、社团介绍文件
│   │   ├── pages.js           # 自定义页面与导航
│   │   ├── applications.js    # 招新模板、提交、审核、预览、导出
│   │   ├── dailyIdeas.js      # 每日一设
│   │   ├── proposals.js       # 活动提案与投票
│   │   ├── messages.js        # 留言板
│   │   ├── groups.js          # 小组管理
│   │   ├── users.js           # 用户与角色管理
│   │   ├── notices.js         # 通知公告
│   │   ├── directions.js      # 发展方向 + 角色申请
│   │   ├── categories.js      # 活动分类
│   │   └── mail.js            # SMTP 配置与发信日志
│   ├── services/
│   │   ├── pageRenderer.js    # SSR 模板注入与水合数据
│   │   └── mailer.js          # 邮件发送与模板
│   └── utils/
│       ├── docConverter.js    # LibreOffice Word→PDF
│       ├── excelExporter.js   # Excel XML / CSV 生成
│       └── filenameFixer.js   # 中文文件名乱码修复
├── public/                    # 前端静态资源（9 个 HTML + CSS/JS）
├── scripts/
│   ├── smoke-test.js          # 冒烟测试（语法 / 漏导入 / 路由导出）
│   └── migrate-sqlite-to-mysql.js
├── uploads/                   # 运行时上传目录（不入库）
│   ├── templates/             # 申请表模板
│   ├── submissions/           # 用户提交的申请表
│   ├── daily_ideas/           # 每日一设附件
│   └── club/                  # 社团介绍文件
├── data/                      # SQLite 数据文件（不入库）
├── Dockerfile
├── docker-compose.yml         # 开发环境
└── docker-compose.prod.yml    # 生产环境
```

---

## 数据模型

共 19 张表，按业务域划分：

| 业务域 | 表 |
|---|---|
| 账号与权限 | `users`、`role_applications` |
| 门户内容 | `portal_config`、`site_pages`、`notices`、`club_documents` |
| 招新 | `application_templates`、`membership_applications` |
| 社员运营 | `club_groups`、`club_group_members`、`daily_ideas`、`activity_proposals`、`proposal_votes`、`member_messages` |
| 字典 | `development_directions`、`activity_categories` |
| 系统 | `system_settings`、`mail_logs`、`email_verification_codes` |

> 表结构由 `src/db/database.js` 在启动时自动创建与升级（含 `ALTER TABLE` 兼容旧库），MySQL 与 SQLite 双引擎共用同一套业务 SQL。

---

## API 概览

所有接口以 `/api` 为前缀，返回统一结构 `{ success, message?, data? }`。鉴权方式：`Authorization: Bearer <token>` 或 Cookie `token`。

| 模块 | 前缀 | 主要能力 | 权限 |
|---|---|---|---|
| 认证 | `/api/auth` | 发送验证码、注册、登录、登出、当前用户、改资料、改密码 | 公开 / 登录 |
| 门户 | `/api/portal` | 门户配置读写、社团介绍文件上传下载 | 公开读 / 管理员写 |
| 页面 | `/api/pages` | 导航列表、页面详情、增删改 | 公开读 / 管理员写 |
| 招新 | `/api/applications` | 模板管理、提交申请、我的申请、预览/下载、审核、导出、转换状态 | 分级 |
| 每日一设 | `/api/daily-ideas` | 提交、我的列表、管理员列表、PDF 预览、下载、评阅、删除 | 成员及以上 |
| 提案 | `/api/proposals` | 列表、详情、发起、投票、决策、批量删除 | 公开读 / 登录写 |
| 留言 | `/api/messages` | 列表、发帖、回复、置顶、删除 | 成员发帖 / 管理员管理 |
| 小组 | `/api/groups` | 我的小组、改组信息、候选成员、增删成员、全部小组 | 登录 / 管理员 |
| 用户 | `/api/users` | 用户列表、角色变更、提拔/降级、重置密码、删除 | 管理员 / 超管 |
| 公告 | `/api/notices` | 列表（按角色过滤）、详情、发布、删除 | 公开读 / 管理员写 |
| 方向/角色申请 | `/api/directions` | 方向字典、角色申请提交与审批 | 登录 / 管理员 |
| 分类 | `/api/categories` | 活动分类增删改查 | 公开读 / 管理员写 |
| 邮件 | `/api/mail` | SMTP 配置、测试发信、日志、群发 | 超管 / 管理员 |

完整路由定义见 `src/routes/*.js`。

---

## 角色与权限

| 角色 | 标识 | 权限范围 |
|---|---|---|
| 普通用户 | `user` | 浏览公开内容、提交入社申请、查看自己的申请进度 |
| 社团成员 | `member` | 以上全部 + 成员专享公告、每日一设、留言、提案与投票、申请成为管理员 |
| 管理员 | `admin` | 以上全部 + 招新审核、模板管理、公告发布、留言管理、小组管理、评阅每日一设 |
| 超级管理员 | `super_admin` | 以上全部 + 用户角色任免、重置密码、SMTP 配置、全部小组查看 |

鉴权采用层级包含判断：`super_admin ⊃ admin ⊃ member ⊃ user`。注册接口强制 `role = 'user'`，提权到 `admin` 仅超管可操作，超管角色不可被修改。

---

## 生产部署

1. **准备环境变量**：复制 `.env.example` 为 `.env`，填写 `DB_PASSWORD` 与 `JWT_SECRET`（`docker-compose.prod.yml` 通过变量注入，缺失会直接报错）。
2. **启动服务**：

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **数据持久化**：`campus_uploads_data`、`campus_db_data` 两个 volume 分别保存附件与 SQLite 数据，请纳入备份。
4. **反向代理（可选）**：使用 Nginx 时务必设置 `TRUST_PROXY=1`，否则限流会把所有请求算作同一 IP：

   ```nginx
   location / {
     proxy_pass http://127.0.0.1:5624;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

5. **HTTPS**：启用 TLS 后设置 `COOKIE_SECURE=true`，让登录 Cookie 仅走加密通道。

---

## 开发与测试

```bash
npm start      # 启动服务
npm test       # 冒烟测试
```

`npm test` 执行 `scripts/smoke-test.js`，覆盖三类易错问题（无需数据库、不启动服务）：

1. 所有源文件语法可编译；
2. 跨文件工具函数是否存在「使用了但忘记 require」；
3. 路由模块是否正确导出 Express Router。

CI 配置位于 `.github/workflows/ci.yml`，在 push / PR 时自动执行 `npm ci && npm test`。

**编码约定**：后端按 `routes → services → utils` 分层，路由只做参数校验与响应，复杂逻辑下沉到 service；数据库访问统一走 `query / getOne / execute / withTransaction`，避免直接使用驱动。

---

## 常见问题

<details>
<summary><b>MySQL 连不上会怎样？</b></summary>

启动时会重试 5 次（每次间隔 3 秒），仍失败则自动降级到 SQLite（`data/campus_club.db`）。降级依赖 `node:sqlite`，因此 Node 必须 ≥ 22.5。若希望强制使用 MySQL，请检查 `DB_HOST` / `DB_PORT` 与账号权限。
</details>

<details>
<summary><b>Word 申请表无法在线预览？</b></summary>

需要安装 LibreOffice。Docker 镜像已内置；本地可安装后重启服务。管理员可访问 `GET /api/applications/converter-status` 查看转换器状态。未安装时系统会给出下载原件的引导页，不影响审核流程。
</details>

<details>
<summary><b>上传的中文文件名变成乱码？</b></summary>

系统内置 `fixMojibake()`，会自动还原被 Latin-1 / CP1252 二次编码的文件名，并在启动时自愈历史数据。若仍有异常，请检查上传时的编码来源。
</details>

<details>
<summary><b>接口返回 429？</b></summary>

触发了限流：全局 API 每 IP 每分钟 300 次；验证码同 IP 每分钟 5 次、同邮箱每小时 5 次；登录同 IP + 账号 15 分钟 15 次；申请表提交每分钟 2 次；留言每分钟 3 条。响应头 `Retry-After` 会给出等待秒数。
</details>

<details>
<summary><b>已审核申请的附件不见了？</b></summary>

系统默认在审核通过 / 驳回 **30 天**后清理附件（只清空文件与字段）。可通过 `ATTACHMENT_RETENTION_DAYS` 调整，设为 `0` 或负数即可完全关闭自动清理。
</details>

<details>
<summary><b>登录后立刻掉线？</b></summary>

多为 `COOKIE_SECURE=true` 但站点仍走 HTTP 导致浏览器不回传 Cookie。请在全站启用 HTTPS 后再开启该项，或临时设为 `false`。
</details>

<details>
<summary><b>如何修改首页文案？</b></summary>

登录后台 `/admin` → 门户配置，修改 Hero 文案、统计数据、部门与联系方式；页面级文案在「页面管理」中按 `data-cms-field` 字段配置，保存后前台立即生效。
</details>

---

## 安全须知

- `.env`、`data/`、`uploads/`、`backups/` 已在 `.gitignore` 中排除，**请勿提交**。
- `JWT_SECRET` 与数据库密码若曾进入版本库，请立即轮换；必要时用 `git filter-repo` 重写历史。
- 上传目录不在 `public/` 下，附件必须通过带鉴权的接口访问。
- 生产环境建议开启 HTTPS 并设置 `COOKIE_SECURE=true`，同时通过 `TRUST_PROXY` 正确传递客户端 IP。
- 超管初始密码仅在首次创建时输出，请第一时间修改。

---

## License

[ISC](https://opensource.org/licenses/ISC)
