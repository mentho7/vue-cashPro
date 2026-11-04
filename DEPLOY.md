# CashPro 部署手册

> **适用环境**：Ubuntu 24.04 LTS · nginx 1.24.0 · 阿里云 ECS `47.116.75.3` · 域名 `minthol.cn`
> **校准时间**：2026-11-04（以服务器实际配置与数据目录为准，覆盖此前版本）
> **配套文件**：[DATA_SPEC.md](DATA_SPEC.md)（数据结构契约）、[deploy/nginx-data.conf](deploy/nginx-data.conf)（数据目录 nginx 片段）

---

## 0. 三分钟看懂：代码与数据是两条独立的发布通道

```
本地 D:\WorkSpace\vue-cashPro
  │
  ├─ npm run build ──→ dist/{index.html, assets/}
  │      │
  │      └─ 只推这 2 样 ──────→ /var/www/cashpro/dist/
  │                                  └─ nginx: root = 这个目录
  │
  └─（数据不走部署）────────→ /var/www/cashpro/data/
                                     └─ nginx: location /data/ → alias 到这个目录
```

**必须记住的三个事实**（旧版文档在这里是错的，见附录）：

1. **数据不在 `dist/` 里**。nginx 用 `location /data/ { alias /var/www/cashpro/data/; }` 单独服务数据目录，与 `dist/` 完全解耦。
2. **数据是按日期命名的一堆文件**，不是 `morning_latest.json` 单文件。当前线上：`morning/` 43 个、`evening/` 40 个。
3. **`scp -r dist/*` 是危险的**。本地 `public/data/` 是空目录，`dist/data/` 因此也是空的——整目录覆盖会把它推到服务器上，虽然 nginx 不读它，但会与真实数据目录混淆，未来极易踩坑。

---

## 1. 环境事实（已逐条核对）

| 项 | 实际值 |
|---|---|
| nginx | 1.24.0 (Ubuntu)，`systemctl is-active nginx` = active |
| 站点配置 | `/etc/nginx/sites-available/cashpro`（HTTP + HTTPS 双 server 块） |
| 站点根 | `/var/www/cashpro/dist`，`index index.html` |
| 数据路由 | `location /data/` → `alias /var/www/cashpro/data/`，带 `Access-Control-Allow-Origin: *` 和 `no-cache` |
| HTTPS | Let's Encrypt，`/etc/letsencrypt/live/minthol.cn/` |
| 数据规模 | `data/morning/` 43 个 JSON、`data/evening/` 40 个 JSON、`data/health.json` |
| 目录属主 | `/var/www/cashpro` 与 `data` 为 `root:root 755`；`dist` 为 `root:root 751`（异常位，见 §8） |
| 备份目录 | `/var/www/cashpro/dist_backup`、`/var/www/cashpro/dist.bak.20260803133517` |
| 服务器工具 | `rsync`、`tar`、`scp` 均可用 |
| 本地工具链 | Node v26.13.0 · npm 11.20.0 · vite 8.2.0 · vue 3.5.40 |

---

## 2. 发布前：本地验收（必做，约 5 分钟）

### 2.1 干净构建

```bash
cd /d/WorkSpace/vue-cashPro      # Git Bash；或在本目录用 PowerShell
npm ci                            # 严格按 package-lock 安装，勿用 npm install 改动 lock
npm run build                     # 产物在 dist/
```

预期输出（当前版本基线）：`index.html` ≈ 0.42 kB、`assets/index-*.css` ≈ 22.2 kB、`assets/index-*.js` ≈ 93.1 kB，耗时 < 1 秒。

### 2.2 本地直接预览 → 只会看到空态，这是正常的

```bash
npm run preview -- --port 4173
# 浏览器打开 http://localhost:4173
```

原因：`src/utils/dataLoader.js` 按**当天日期**去拉 `/data/morning/YYYY-MM-DD-morning.json`，而本地 `public/data/` 是空目录，必然 404。此时页面应显示空态文案（`盘后数据尚未更新` 等），**控制台出现 404 不是缺陷**。

### 2.3 用生产数据做真实渲染验收（推荐）

`dataLoader.js:35` 支持 `VITE_DATA_BASE`，把数据基址指向线上即可在本地跑真实数据（线上 `/data/` 已带 `Access-Control-Allow-Origin: *`，跨域可用）：

```bash
VITE_DATA_BASE=https://minthol.cn npm run build
npm run preview -- --port 4173
```

> ⚠ **测完必须重新执行一次不带该变量的 `npm run build`**，否则生产域名会被烘进 `import.meta.env`，这份产物不能发布。

### 2.4 产物自检（不依赖浏览器）

```bash
# 1) 中文字符串集合指纹——与线上产物的指纹应一致
python -c "import re,io,glob,hashlib;s=set();[s.update(re.findall('[\u4e00-\u9fff]{2,}',io.open(f,encoding='utf-8',errors='ignore').read())) for f in glob.glob('dist/assets/*.js')+glob.glob('dist/assets/*.css')];t='\n'.join(sorted(s));print(len(s),hashlib.md5(t.encode()).hexdigest())"

# 2) 确认新功能已进包（历史表格可点击 + 未来事件文案）
grep -c "table-row-clickable" dist/assets/*.css
grep -o "未来 5 条重大市场事件" dist/assets/*.js
```

---

## 3. 部署静态站点（只推 2 类文件）

### 3.1 先在服务器备份

```bash
ssh root@47.116.75.3 'cd /var/www/cashpro && cp -a dist dist.bak.$(date +%Y%m%d%H%M%S) && ls -d dist.bak.*'
```

### 3.2 上传（Windows / PowerShell · Git Bash 均适用）

```bash
# ① 资源目录（带 hash，新增不会冲突）
scp -r dist/assets root@47.116.75.3:/var/www/cashpro/dist/

# ② 入口文件（必须最后传，保证新旧资源切换原子）
scp dist/index.html root@47.116.75.3:/var/www/cashpro/dist/index.html
```

> **不要**执行 `scp -r dist/* root@47.116.75.3:/var/www/cashpro/dist/`：它会把空 `data/`、`docs/` 一起推上去。
> 若本机有 rsync（WSL / Git Bash）可顺手清理旧资源：`rsync -av --delete dist/assets/ root@47.116.75.3:/var/www/cashpro/dist/assets/`（`--delete` 作用域仅限 `assets/`，安全）。

### 3.3 部署后校验（无需 reload nginx，纯静态）

```bash
curl -I https://minthol.cn/ | head -3
curl -s https://minthol.cn/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1
# 用上一步拿到的文件名再验一次 200
curl -o /dev/null -w "%{http_code} %{size_download}B\n" https://minthol.cn/assets/index-XXXX.js
curl -s https://minthol.cn/data/health.json
```

判定：首页 200、asset 200 且体积与本地 `dist/assets` 一致、`health.json` 返回 `{"status":"ok"...}`。

---

## 4. 数据发布（独立通道，与代码发布互不影响）

### 4.1 目录与命名契约

```
/var/www/cashpro/data/
├── health.json                        # 健康探针
├── morning/2026-07-27-morning.json    # 早盘：date, summary, sentiment, bullishDirections, bearishDirections, fullReport
└── evening/2026-07-27-evening.json    # 晚盘：date, hitResult, afterHoursSummary, marketEvents[]
```

- 前端按**当天日期**取当日文件，并向过去 30 天回溯构建历史表格；缺失日期直接跳过（不报错）。
- `marketEvents` 为 v4 结构化格式：`{ direction: "利好"|"利空", sector: "板块名", event: "事件描述" }`。字段细节以 [DATA_SPEC.md](DATA_SPEC.md) 为准。

### 4.2 上传单日数据（原子写法，避免前端读到半个文件）

```bash
scp 2026-11-04-morning.json root@47.116.75.3:/tmp/
ssh root@47.116.75.3 'mv /tmp/2026-11-04-morning.json /var/www/cashpro/data/morning/ && chown root:root /var/www/cashpro/data/morning/2026-11-04-morning.json'
```

**禁止**为了"刷新"而清空 `data/` 目录（`rm -rf /var/www/cashpro/data/*`）——那里是 40+ 天积累的唯一副本，代码可通过备份回滚，数据不能。

---

## 5. 回滚

```bash
ssh root@47.116.75.3 'cd /var/www/cashpro && ls -d dist.bak.* | tail -3'
ssh root@47.116.75.3 'cd /var/www/cashpro && rm -rf dist && cp -a dist.bak.<时间戳> dist'
```

数据无需回滚（与代码解耦）。回滚后按 §3.3 复验一次。

---

## 6. 端到端验收清单

发布后打开 `https://minthol.cn`，逐项勾选：

- [ ] 首页正常渲染，无白屏（`index.html` 指向的 asset 必须 200）
- [ ] 控制台无 `[CashPro] 数据加载失败`
- [ ] 交易观点卡片显示盘前数据
- [ ] **点击历史表格任意有数据行 → 弹窗显示当日完整盘前计划**（本次新增能力）
- [ ] 无报告的日期行：鼠标悬停提示「当日暂无完整报告」，点击无反应（不应报错）
- [ ] 键盘 Tab 到表格行后按 Enter / 空格同样能打开弹窗（无障碍路径）
- [ ] 时间线标题为「未来市场事件」，副标题为「未来 5 条重大市场事件」
- [ ] 复盘卡片三列命中结果配色为设计确认后的色值（`#3A7BD5 / #D9B44A / #5A6C8A`）
- [ ] 数据缺失日显示「盘后数据尚未更新」空态

---

## 7. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 白屏 / 首页 404 | `index.html` 未更新，或引用的 asset 未上传 | 补传 `index.html` + `assets/`，用 §3.3 的第一条 curl 定位 |
| 页面能开但无数据 | `/data/` 404 或 alias 未生效 | `curl https://minthol.cn/data/health.json`；查 `/etc/nginx/sites-available/cashpro` 的 alias 路径 |
| 有新数据但页面仍旧 | 浏览器/中间层缓存 | 数据已带 `no-cache`，强制刷新（Ctrl+F5） |
| 点击表格行弹窗不弹 | 该行 `fullReport` 为空 | 属预期（`HistoryTable` 有 `if (!row.fullReport) return`）；检查对应 morning JSON 的 `fullReport` 字段 |
| 本地预览全是 404 | `public/data/` 为空，本地无数据 | 属正常；按 §2.3 用 `VITE_DATA_BASE` 指向线上验证 |
| HTTPS 证书告警 | 证书过期 | `certbot renew --dry-run` → `certbot renew` |

---

## 8. 安全与权限注意

- **`/var/www/cashpro/dist` 权限是 `drwx---rwx`（751）**，group 无权限、other 有 `rwx`，属于历史误设。建议修正为 `chmod 755`：`ssh root@47.116.75.3 'chmod 755 /var/www/cashpro/dist'`。修正前请注意，任何能登录该机的账号都对该目录可写。
- 不要直接改 `/etc/nginx/**` 做临时验证；改配置必须 `nginx -t` 通过再 `systemctl reload nginx`。
- 生产机为 root 登录：建议后续收敛为普通用户 + sudo，SSH 密钥登录（参见旧文档第四步的密钥思路，本次不做变更）。
- 本地 `package-lock.json` 已与 `master` 一致，**任何 `npm install <包名>` 都会污染 lock**，部署构建只用 `npm ci`。

---

## 附录：与旧版 DEPLOY.md 的关键勘误

旧版文档保留于 `dist.bak.*` 之外的仓库历史中，以下 5 处已在本次校准中修正，请勿再照旧版执行：

| 旧版说法 | 实际情况 |
|---|---|
| 数据为 `morning_latest.json` / `evening_latest.json` / `history.json` 三文件 | 已改为 `morning/YYYY-MM-DD-morning.json`、`evening/YYYY-MM-DD-evening.json` 按日期分目录（43 + 40 个） |
| 架构图称前端 fetch `/data/morning_latest.json` | 实际由 `src/utils/dataLoader.js` 按当天日期 + 回溯 30 天动态拼接 URL |
| 部署命令 `scp -r dist/* root@…:/var/www/cashpro/dist/` | 会把空 `data/`、`docs/` 一并推上去；只应传 `assets/` 与 `index.html` |
| 数据放在 `/var/www/cashpro/data/` 下"平铺" | 目录结构为 `data/{morning,evening}/`，nginx 用 alias 而非 root |
| Cron Prompt 中写死 `F:\filetoAI\2026-08-02-14-39-00\cashpro\...` | 该路径已失效；数据生成流程请以 `scripts/build-data.js` 与当前工作目录为准 |
