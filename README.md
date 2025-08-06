# 🌐 Cloudflare Uptime Monitor

一个**无需服务器、支持自动 + 手动监控、状态日志记录和 Telegram 通知的**网站可用性监控系统。
基于 **Cloudflare Workers Functions + D1 数据库 + GitHub Actions + Telegram Bot** 构建。

---

## ✨ 功能特性

* ✅ **自动定时监控**：通过 Cloudflare 的 `scheduled` 功能，每 5 分钟检查一次网站状态
* 👆 **手动触发监控**：访问指定路径即可立即刷新检测
* 📈 **历史日志记录**：状态变化写入 D1 数据库
* 🚨 **Telegram 通知**：故障或恢复时自动提醒
* 🔍 **在线查看状态日志**：可通过 Web 查看历史状态
* 🔧 **配置自检功能**：访问根路径 `/` 检查当前配置是否正确
* 🧹 **自动清理日志**：保留最近 5 周记录，定期清除旧数据

---

## 🚀 快速开始

### 🧩 Step 1: Fork本GIthub项目

---

### 🏗️ Step 2: 新建 D1 数据库

登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 选择你的账号 → `存储和数据库` → `D1` → 创建数据库：

* 数据库名称：如 `uptime-monitor`
* 创建后，记录：

  * `D1_DATABASE_NAME`：即你命名的名称
  * `D1_DATABASE_ID`：创建成功后在详情页看到的 ID（UUID 格式）

---

### 🔑 Step 3: 获取 Cloudflare API 凭据

进入 [Cloudflare Dashboard](https://dash.cloudflare.com/)：

* **Account ID**：

  * 进入任意站点 → 页面底部可见 `API` 栏中的 `Account ID`
  * 变量名为 `CLOUDFLARE_ACCOUNT_ID`
* **API Token**：

  * 进入 `My Profile` → `API Tokens` → `Create Token`
  * 选择 `Edit Cloudflare Workers` 模板或自定义权限

    * 至少包含：Workers、D1、Pages 权限
  * 创建后复制该值，用作 GitHub Secret `CLOUDFLARE_API_TOKEN`

---

### ⚙️ Step 4: 配置 GitHub Actions Variables & Secrets

进入你的 GitHub 仓库页面：

→ `Settings > Secrets and variables > Actions`

添加如下配置项：

| 名称                     | 类型     | 示例值                                                                                          |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Secret   | `f81d30xxxxxxxxxxxxxxxxxxxxxx`                                                                  |
| `CLOUDFLARE_API_TOKEN`  | Secret   | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`                                                              |
| `TELEGRAM_BOT_TOKEN`    | Secret   | `123456789:ABCxxxxxxxxxxxxxxxxxxxxxxxx`                                                         |
| `TELEGRAM_CHAT_ID`      | Secret   | `-1001234567890`                                                                                |
| `MONITOR_CONFIG_JSON`   | Variable | `[{"name":"example","url":"https://example.com"},{"name":"google","url":"https://google.com"}]` |
| `D1_DATABASE_NAME`      | Variable | `uptime-monitor`（你创建的 D1 名称）                                                             |
| `D1_DATABASE_ID`        | Variable | `7d08819d-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                                                          |

---

### 🛠️ Step 5: 初始化 D1 数据库结构

在 D1 控制台粘贴执行 `schema.sql` 中的内容

---

### ☁️ Step 6: 启用并部署 GitHub Actions

提交代码推送到 GitHub，触发自动部署

---

## 📚 使用说明

### 🔍 配置检查

访问首页可查看配置项状态：

```
https://your-project.workers.dev/
```

---

### 👆 手动触发检测

访问：

```
https://your-project.workers.dev/UUID/check
```

将 `UUID` 替换为你设置的环境变量值。

---

### 📜 查看日志记录

访问：

```
https://your-project.workers.dev/UUID/log?name=example&limit=20
```

* `name`: 监控网站配置中的 `name`
* `limit`: 返回日志条数，默认最多 20

---

### 🧾 获取配置信息

查看系统当前配置：

```
https://your-project.workers.dev/UUID/info
```

---

## 🧠 监控机制

* 使用 `fetch` 对每个网站发起 `GET` 请求
* 如果响应状态码不是 200，或者访问超时（30 秒），即判定为 `down`
* 与上一次状态不同 → 写入数据库 + Telegram 通知
* 每次检测写入数据库，并保留 5 周日志，旧日志自动删除

---

## 🔐 安全建议

* `UUID` 建议使用复杂随机值（如 uuidgen）防止滥用接口
* 所有敏感信息（如 Telegram Token）均存储于 GitHub Secrets
* D1 无需手动配置连接，仅需配置 ID + 名称

---

## 🛠️ 常见问题 FAQ

### Q：自动部署失败

* 在github项目Actions中查看Deploy to Cloudflare Workers的具体信息，根据日志排查

### Q: 如何调试定时任务？

* 在 \[Cloudflare Dashboard > Workers & D1 > Cron Triggers] 可查看执行日志
* 或通过 `/UUID/check` 路径手动测试

### Q: 数据库连接失败？

* 检查 GitHub 变量配置中的 `D1_DATABASE_NAME` 与 `D1_DATABASE_ID`
* 检查 GitHub Actions 日志中的绑定信息
* 首页路径 `/` 可显示当前配置状态

---

## 📁 项目结构说明

```
├── .github/
│   └── workflows/
│       └── deploy.yml        # 自动部署配置
├── functions/                # 函数目录
│   ├── check.ts              # 检测网站在线
│   ├── fetch.ts
│   ├── home.ts
│   ├── logs.ts
│   └── scheduled.ts          # 定时检测
├── lib/                      # 库函数目录
│   ├── auth.ts
│   ├── config.ts             # 配置解析
│   ├── fetchWithTimeout.ts   # 带超时的 fetch 函数
│   ├── healthcheck.ts        # 健康检查
│   ├── telegram.ts           # Telegram 通知
│   └── time.ts               # 时间相关函数
├── index.ts                  # Cloudflare Workers 主文件
├── schema.sql                # D1 数据库结构定义
├── wrangler.toml             # Cloudflare Wrangler 配置（自动生成）
└── README.md
```

---

## 📝 License

本项目采用 MIT License，欢迎自由使用和修改。

