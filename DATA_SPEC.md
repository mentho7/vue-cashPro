# CashPro 数据格式规范 v3

## 数据管道

```
WorkBuddy 定时任务               scp 上传                  前端运行时拉取
  │                                │                        │
  ├─ 早盘 8:00 ──→ morning JSON ──→ /data/morning/今天-morning.json ──→ loadData()
  │                                │                        │
  └─ 晚盘 16:30 ─→ evening JSON ──→ /data/evening/今天-evening.json ──→  │
                                                             │
                                                    合并 → 渲染页面
```

**核心规则：**
- 每天输出 2 个文件，各放到 date-named 子目录
- 文件名格式：`YYYY-MM-DD-morning.json` / `YYYY-MM-DD-evening.json`
- 不做 history.json 聚合——前端自动扫描过去 30 天的 dated 文件来构建历史
- 旧文件可直接 `rm /data/morning/2026-07-*-morning.json` 批量清理

---

## 服务器目录结构

```
/var/www/cashpro/data/
├── health.json              (健康检查，仅此一个固定文件)
├── morning/
│   ├── 2026-08-03-morning.json      (8月3日早盘预测)
│   ├── 2026-08-04-morning.json
│   └── ...
└── evening/
    ├── 2026-08-03-evening.json      (8月3日晚盘复盘)
    ├── 2026-08-04-evening.json
    └── ...
```

## 上传命令

```bash
# 早盘预测 → /data/morning/
scp -i ~/.ssh/id_ed25519_cashpro 2026-08-03-morning.json root@47.116.75.3:/var/www/cashpro/data/morning/

# 晚盘复盘 → /data/evening/
scp -i ~/.ssh/id_ed25519_cashpro 2026-08-03-evening.json root@47.116.75.3:/var/www/cashpro/data/evening/

# 批量清理 7 天前的旧数据
ssh root@47.116.75.3 "find /var/www/cashpro/data/morning/ -name '*-morning.json' -mtime +7 -delete"
ssh root@47.116.75.3 "find /var/www/cashpro/data/evening/ -name '*-evening.json' -mtime +7 -delete"
```

---

## 文件 1：早盘预测 `/data/morning/YYYY-MM-DD-morning.json`

WorkBuddy 早盘定时任务生成，包含当日盘前分析的全部信息。

```json
{
  "date": "2026-08-03",
  "summary": "今日A股市场预计延续震荡偏强格局。AI应用、半导体等科技板块在政策暖风与资金回流双重驱动下有望继续领涨，银行和地产链仍面临压力。",
  "sentiment": "乐观",
  "bullishDirections": ["AI应用", "半导体", "大消费", "新能源"],
  "bearishDirections": ["银行", "地产链", "煤炭"],
  "fullReport": "# 08月03日盘前计划\n\n## 一、宏观观察\n..."
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `date` | string | ✅ | 严格 `YYYY-MM-DD`，必须与文件名日期一致 |
| `summary` | string | ✅ | 80–200 字，概括今日总体判断和核心逻辑 |
| `sentiment` | string | ✅ | 仅限 `"乐观"` / `"谨慎"` / `"中性"` / `"悲观"` |
| `bullishDirections` | string[] | ✅ | 利好板块名称，每项 2–6 字，建议 2–5 项 |
| `bearishDirections` | string[] | ✅ | 利空板块名称，每项 2–6 字，建议 2–5 项 |
| `fullReport` | string | ✅ | 完整盘前计划 Markdown，不限长度 |

---

## 文件 2：晚盘复盘 `/data/evening/YYYY-MM-DD-evening.json`

WorkBuddy 晚盘定时任务生成，包含命中验证 + 市场事件。

```json
{
  "date": "2026-08-03",
  "hitResult": "准确命中",
  "afterHoursSummary": "AI应用板块如期领涨，全天涨幅 3.2%；消费电子午后超预期走强，方向判断与预期基本吻合。",
  "marketEvents": [
    {
      "direction": "利空",
      "sector": "出口/新能源车",
      "event": "美国宣布对华新能源汽车加征 100% 关税细则"
    },
    {
      "direction": "利好",
      "sector": "医药",
      "event": "国家医保局发布新版医保目录调整方案"
    },
    {
      "direction": "利好",
      "sector": "半导体",
      "event": "台积电 7 月营收超预期，AI 芯片需求持续旺盛"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `date` | string | ✅ | 严格 `YYYY-MM-DD`，必须与文件名日期一致 |
| `hitResult` | string | ✅ | 仅限 `"准确命中"` / `"小幅偏差"` / `"明显偏差"` |
| `afterHoursSummary` | string | ✅ | 80–200 字，描述今日实际走势与预测的对比 |
| `marketEvents` | array | ✅ | 当天或近期值得关注的市场事件，建议 3–6 条 |

### marketEvents 元素结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `direction` | string | ✅ | `"利好"` 或 `"利空"` |
| `sector` | string | ✅ | 受影响的板块，2–8 字，如 `"半导体"`、`"出口/新能源"` |
| `event` | string | ✅ | 事件一句话描述，10–40 字 |

> **前端展示映射：** `direction + " · " + sector` → 时间线 tag（利好=绿底、利空=红底），`event` → 时间线标题。

---

## hitResult 三分类 → 前端展示映射

| 你传入 | 图标 | 方向验证文案 | 颜色 |
|--------|------|-------------|------|
| `准确命中` | ✓ | 方向完全正确，利好/利空板块走势与预期一致。 | 蓝 `#3A7BD5` |
| `小幅偏差` | ≈ | 大方向正确，但部分板块涨跌幅度或节奏存在偏差。 | 金 `#D9B44A` |
| `明显偏差` | ✗ | 方向判断错误，板块涨跌与预期明显不符。 | 灰 `#5A6C8A` |

---

## WorkBuddy 定时任务 Prompt 模板

### 任务 A：早盘盘前计划（每天 7:30 执行）

```
你是一名专业的 A 股市场分析师，负责每日盘前预测。

## 任务
根据你掌握的最新市场信息（消息面、资金面、外围市场、政策动态），生成一份结构化的早盘预测 JSON 文件。

## 输出要求
输出一个 JSON 对象，不包含任何解释或 Markdown 格式，只输出纯 JSON。每个字段都必须填写真实内容，不得出现占位符或空字符串。

## JSON Schema（严格遵循）
{
  "date": "YYYY-MM-DD（今天日期）",
  "summary": "80-200 字：用一段话概括今日总体判断，必须包含：① 对大盘方向的定性判断（偏强/震荡/偏弱）② 2-3 个利好板块及核心逻辑 ③ 1-2 个需要回避的板块",
  "sentiment": "乐观 / 谨慎 / 中性 / 悲观 之一",
  "bullishDirections": ["板块A", "板块B", "板块C"],
  "bearishDirections": ["板块X", "板块Y"],
  "fullReport": "完整盘前计划 Markdown，结构如下：
## 一、宏观与消息面
- 国际市场动态（美股/港股/汇率/大宗）
- 国内政策与重要事件
- 资金面情况（北向/成交量/融资）

## 二、板块机会分析
每个利好板块独立小段，含判断理由

## 三、风险提示
每个利空板块独立小段，含判断理由

## 四、操作策略建议
- 仓位建议
- 重点关注标的类型
- 止损/止盈思路"
}

## 注意事项
1. date 必须与文件名日期一致
2. sentiment 只允许四个枚举值之一
3. bullishDirections/bearishDirections 每项 2-6 字，不使用"其他""更多"等模糊词
4. fullReport 必须完整充实，每个章节至少 3 句话
5. 输出前验证：所有字段均非空

## 输出文件命名
将上述 JSON 保存为 `YYYY-MM-DD-morning.json`（今天的日期），该文件将通过 scp 上传至服务器 `/var/www/cashpro/data/morning/`。
```

---

### 任务 B：晚盘盘后复盘（每天 16:30 执行）

```
你是一名专业的 A 股市场复盘分析师，负责每日盘后复盘与命中验证。

## 输入
你今天早上生成的早盘预测 JSON（参考 bullishDirections / bearishDirections 板块列表）。

## 任务
对比今日实际走势与早盘预测，判断命中结果，并整理当天发生的重大市场事件。

## 输出要求
输出一个 JSON 对象，不包含任何解释或 Markdown 格式，只输出纯 JSON。

## JSON Schema（严格遵循）
{
  "date": "YYYY-MM-DD（今天日期）",
  "hitResult": "准确命中 / 小幅偏差 / 明显偏差 之一",
  "afterHoursSummary": "80-200 字：描述今日实际走势，必须包含：① 大盘涨跌幅 ② 早盘看好的板块实际表现（涨/跌及幅度） ③ 早盘看空的板块实际表现 ④ 与预测的吻合/偏离程度小结",
  "marketEvents": [
    {
      "direction": "利好",
      "sector": "板块名称（2-8 字）",
      "event": "事件一句话描述（10-40 字）"
    },
    {
      "direction": "利空",
      "sector": "板块名称（2-8 字）",
      "event": "事件一句话描述（10-40 字）"
    }
  ]
}

## hitResult 判定标准
- 准确命中：大半利好板块确实上涨、大半利空板块确实下跌或横盘，方向判断与市场实际共振
- 小幅偏差：方向大体正确，但 1-2 个板块涨跌幅度与预期存在明显差异，或节奏先后不一致
- 明显偏差：利好板块多数下跌或利空板块多数上涨，整体方向判断错误

## marketEvents 选择标准
- 选择当天或近期对 A 股有实际影响的重大事件
- 优先选择：政策发布、经济数据公布、行业重大动态、外围市场异动
- 不选：纯猜测性分析、与 A 股关联度低的海外事件、个股层面的事件
- 每条 event 必须具体，含事实性内容，不能是泛泛而谈
- 建议 3-6 条，按重要性排序

## 注意事项
1. date 必须与文件名日期一致
2. hitResult 只允许三个枚举值之一
3. direction 只允许 "利好" 或 "利空"
4. sector 和 event 不能为空字符串
5. 输出前验证：所有字段均非空

## 输出文件命名
将上述 JSON 保存为 `YYYY-MM-DD-evening.json`（今天的日期），该文件将通过 scp 上传至服务器 `/var/www/cashpro/data/evening/`。
```

---

## 每日操作流程（汇总）

| 时间 | 操作 | 命令 |
|------|------|------|
| 7:30 | WorkBuddy 生成早盘 JSON | 按「任务 A」Prompt 执行 |
| 8:00 | 上传早盘数据 | `scp -i ~/.ssh/id_ed25519_cashpro YYYY-MM-DD-morning.json root@47.116.75.3:/var/www/cashpro/data/morning/` |
| 15:30 | 收盘，WorkBuddy 生成晚盘 JSON | 按「任务 B」Prompt 执行 |
| 16:00 | 上传晚盘数据 | `scp -i ~/.ssh/id_ed25519_cashpro YYYY-MM-DD-evening.json root@47.116.75.3:/var/www/cashpro/data/evening/` |
| 周末 | 批量清理 7 天前旧数据 | `ssh root@47.116.75.3 "find /var/www/cashpro/data/morning/ -name '*-morning.json' -mtime +7 -delete"` |
