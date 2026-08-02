# CashPro 上线清单

> **适用系统:** Ubuntu 24.04 LTS (apt 包管理器)
> **服务器:** 阿里云 ECS `47.116.75.3` | **域名:** `minthol.cn`

## 架构概览

```
本地 WorkBuddy                阿里云 ECS
    │                            │
    │  scp morning.json ──────→  /var/www/cashpro/data/morning_latest.json
    │  scp evening.json ──────→  /var/www/cashpro/data/evening_latest.json
    │  scp history.json ──────→  /var/www/cashpro/data/history.json
    │                            │
    │                      Nginx 静态服务 + 数据目录
    │                            │
    │  用户浏览器 ←─ HTTPS ─── Vue 静态站点 (dist/)
    │       │
    │       └─ fetch /data/morning_latest.json
    │       └─ fetch /data/evening_latest.json
    │       └─ fetch /data/history.json
    │       └─ 前端 JS 合并 → 动态渲染
```

**零额外费用：** 利用 ECS 自带磁盘和 Nginx，不需租 OSS。

---

## 第一步：服务器初始化（一次性，5 分钟）

### 1.1 登录服务器

```bash
ssh root@47.116.75.3
```

### 1.2 一键初始化（推荐）

将 `server-setup.sh` 上传到服务器执行，自动完成：安装 Nginx → 创建目录 → 写入占位数据 → 配置站点 → 启动服务 → 开放防火墙。

```bash
# 在本地执行（远程注入脚本）
ssh root@47.116.75.3 'bash -s' < deploy/server-setup.sh
```

或手动上传后执行：

```bash
scp deploy/server-setup.sh root@47.116.75.3:/tmp/
ssh root@47.116.75.3 'bash /tmp/server-setup.sh'
```

### 1.3 手动配置 Nginx（如未用一键脚本）

如果已通过 1.2 一键初始化，跳过本步。手动配置方式：

```bash
# 安装 Nginx (Ubuntu 24.04 用 apt)
apt-get update && apt-get install -y nginx

# 站点配置写入 Ubuntu 标准路径
vim /etc/nginx/sites-available/cashpro

# 启用站点 (创建符号链接到 sites-enabled/)
ln -s /etc/nginx/sites-available/cashpro /etc/nginx/sites-enabled/cashpro
rm -f /etc/nginx/sites-enabled/default

# 测试并重载
nginx -t && systemctl reload nginx
```

### 1.4 配置防火墙

```bash
# Ubuntu 24.04 使用 ufw
ufw allow 'Nginx Full'
ufw --force enable
```

> 同时在阿里云控制台 → 安全组 → 添加入方向规则：开放 80 和 443 端口。

### 1.5 配置 HTTPS（推荐）

```bash
# 安装 certbot (Ubuntu 24.04 直接 apt 安装)
apt install -y certbot python3-certbot-nginx

# 一键申请 Let's Encrypt 证书并自动配置 Nginx
certbot --nginx -d minthol.cn

# 自动续期已内置，测试续期:
certbot renew --dry-run
```

### 1.6 验证数据目录可访问

```bash
# 写一个测试文件
echo '{"status":"ok"}' > /var/www/cashpro/data/health.json
# 从本地测试
curl https://minthol.cn/data/health.json
# 应返回 {"status":"ok"}
```

---

## 第二步：上传初始数据（5 分钟）

将本地已有的历史数据上传到服务器，确保首次访问有内容显示。

### 2.1 制作 morning_latest.json

```bash
# 在本地 cashpro/ 目录下执行
scp deploy/sample-morning.json root@47.116.75.3:/var/www/cashpro/data/morning_latest.json
```

### 2.2 制作 evening_latest.json

```bash
scp deploy/sample-evening.json root@47.116.75.3:/var/www/cashpro/data/evening_latest.json
```

### 2.3 制作 history.json

```bash
scp deploy/sample-history.json root@47.116.75.3:/var/www/cashpro/data/history.json
```

---

## 第三步：构建并部署前端（3 分钟）

### 3.1 本地构建

```bash
cd cashpro/
npm run build    # 或用 node_modules/vite/bin/vite.js build
```

输出在 `dist/` 目录。

### 3.2 部署到服务器

```bash
# 部署静态站点
scp -r dist/* root@47.116.75.3:/var/www/cashpro/dist/

# 同时上传示例数据文件
scp deploy/sample-morning.json root@47.116.75.3:/var/www/cashpro/data/morning_latest.json
scp deploy/sample-evening.json root@47.116.75.3:/var/www/cashpro/data/evening_latest.json
scp deploy/sample-history.json root@47.116.75.3:/var/www/cashpro/data/history.json
```

### 3.3 验证

浏览器打开 `https://minthol.cn`，应看到完整看板。

---

## 第四步：配置 SSH 免密登录（用于 WorkBuddy 自动上传）

WorkBuddy 定时任务需要通过 `scp` 自动上传，需要免密。

### 4.1 本地生成 SSH 密钥（如果没有）

```bash
ssh-keygen -t ed25519 -C "workbuddy-cashpro" -f ~/.ssh/id_ed25519_cashpro -N ""
```

### 4.2 复制公钥到服务器

```bash
ssh-copy-id -i ~/.ssh/id_ed25519_cashpro.pub root@47.116.75.3
```

### 4.3 测试免密登录

```bash
ssh -i ~/.ssh/id_ed25519_cashpro root@47.116.75.3 "echo OK"
```

---

## 第五步：配置 WorkBuddy 定时任务

### 5.1 早盘任务（每日 8:00）

**名称：** CashPro 早盘数据上传

**Cron：** `0 8 * * 1-5`（工作日早 8 点）

**Prompt：**

```
你是 CashPro 的数据生成代理。请完成以下任务：

1. 读取最新的盘前分析文档（位于 cashpro/public/docs/ 下按日期命名的 MD 文件，取最新一个）
2. 从中提取以下结构化数据，生成 JSON：
   - date: 日期，格式 YYYY-MM-DD
   - summary: 全文的交易观点总结原文
   - sentiment: 散户情绪，必须是"乐观"/"悲观"/"中性"之一
   - bullishDirections: 利好方向数组，如 ["AI应用","大消费"]
   - bearishDirections: 利空方向数组，如 ["银行","地产链"]
   - fullReport: 完整的 MD 原文（用于前端弹窗展示）
3. 将 JSON 保存到 F:\filetoAI\2026-08-02-14-39-00\cashpro\deploy\out\morning.json
4. 使用 scp 上传到服务器：
   scp -i ~/.ssh/id_ed25519_cashpro F:\filetoAI\2026-08-02-14-39-00\cashpro\deploy\out\morning.json root@47.116.75.3:/var/www/cashpro/data/morning_latest.json

注意：JSON 必须是合法的 UTF-8 编码，不要包含注释。
```

### 5.2 晚盘任务（每日 16:30）

**名称：** CashPro 晚盘数据上传

**Cron：** `30 16 * * 1-5`（工作日 16:30）

**Prompt：**

```
你是 CashPro 的数据生成代理。请完成以下任务：

1. 基于你掌握的最新收盘数据，生成以下 JSON：
   - date: 日期，格式 YYYY-MM-DD
   - hitResult: 命中结果，必须是"准确命中"/"小幅偏差"/"明显偏差"之一
   - afterHoursSummary: 盘后总结，一句话描述实际走势与预测的对比
   - events: 市场事件数组，格式 [{"date":"8月1日","title":"美国公布非农数据","tag":"可能利空出口板块"}]

2. 将 JSON 保存到 F:\filetoAI\2026-08-02-14-39-00\cashpro\deploy\out\evening.json

3. 同时生成 history.json：读取服务器上现有的 /var/www/cashpro/data/history.json，将今天的数据（morning_latest.json + evening_latest.json 合并）追加进去，保持最近 30 条

4. 使用 scp 上传：
   scp -i ~/.ssh/id_ed25519_cashpro F:\filetoAI\2026-08-02-14-39-00\cashpro\deploy\out\evening.json root@47.116.75.3:/var/www/cashpro/data/evening_latest.json
   scp -i ~/.ssh/id_ed25519_cashpro F:\filetoAI\2026-08-02-14-39-00\cashpro\deploy\out\history.json root@47.116.75.3:/var/www/cashpro/data/history.json

注意：hitResult 必须用这三个值之一，不要扩展。
```

---

## 第六步：验证端到端

### 6.1 验证数据文件存在

```bash
ssh root@47.116.75.3 "ls -la /var/www/cashpro/data/"
```

应看到：
- `morning_latest.json`
- `evening_latest.json`
- `history.json`

### 6.2 验证 HTTPS 可访问

```bash
curl https://minthol.cn/data/morning_latest.json | python3 -m json.tool
curl https://minthol.cn/data/evening_latest.json | python3 -m json.tool
curl https://minthol.cn/data/history.json | python3 -m json.tool
```

### 6.3 验证前端加载

浏览器打开 `https://minthol.cn`，检查：
- [ ] 交易观点卡片显示盘前数据
- [ ] 点击交易观点卡片 → 弹窗显示完整报告
- [ ] 复盘报告三列卡片显示命中验证
- [ ] 周度预测成功率环形图有数据
- [ ] 近期市场事件时间线有内容
- [ ] 历史交易观点表格有数据

---

## 附录 A：目录结构总览

```
cashpro/                        # 本地项目
├── src/                            # Vue 源码
├── dist/                           # 构建产物 → 上传到服务器
├── deploy/
│   ├── DEPLOY.md                   # 本文件
│   ├── nginx-data.conf             # Nginx 数据目录配置
│   ├── server-setup.sh             # 服务器一键初始化脚本
│   └── out/                        # WorkBuddy 输出目录
│       ├── morning.json            # 早盘生成
│       ├── evening.json            # 晚盘生成
│       └── history.json            # 合并历史
├── public/docs/                    # 手动词版留档（可选）
└── DATA_SPEC.md                    # 数据格式规范

服务器:
/var/www/cashpro/
├── dist/                           # 静态站点
└── data/
    ├── morning_latest.json         # 最新早盘数据
    ├── evening_latest.json         # 最新晚盘数据
    └── history.json                # 全量历史记录
```

---

## 附录 B：需要开启的权限

| 权限 | 用途 | 如何开启 |
|------|------|----------|
| ECS 22 端口（SSH） | scp 上传文件 | 阿里云安全组开放 22 端口（通常默认已开） |
| ECS 80 端口（HTTP） | 用户访问站点（HTTP） | 安全组开放 80 + `ufw allow 'Nginx Full'` |
| ECS 443 端口（HTTPS） | 用户访问站点（HTTPS） | 安全组开放 443 + `ufw allow 'Nginx Full'` |
| SSH 密钥免密 | WorkBuddy 自动上传 | 见第四步 |
| HTTPS 证书 | Let's Encrypt 免费证书 | `certbot --nginx -d minthol.cn`（见 1.5） |

> **双重防火墙**: 阿里云 ECS 有两层防火墙——阿里云安全组（云端）和 ufw（系统内）。两层都要开放端口才能访问。

---

## 附录 C：数据格式速查

### morning_latest.json
```json
{
  "date": "2026-08-03",
  "summary": "今日市场预计震荡偏强...",
  "sentiment": "乐观",
  "bullishDirections": ["AI应用", "大消费"],
  "bearishDirections": ["银行", "地产链"],
  "fullReport": "# 08月03日盘前计划\n\n## 市场观察\n\n..."
}
```

### evening_latest.json
```json
{
  "date": "2026-08-03",
  "hitResult": "准确命中",
  "afterHoursSummary": "AI应用如期领涨...",
  "events": [
    {"date": "8月1日", "title": "美国公布非农数据", "tag": "可能利空出口板块"}
  ]
}
```

### history.json
```json
[
  {
    "date": "2026-08-02",
    "summary": "...",
    "sentiment": "乐观",
    "bullishDirections": ["AI应用"],
    "bearishDirections": ["银行"],
    "hitResult": "准确命中",
    "afterHoursSummary": "..."
  }
]
```
