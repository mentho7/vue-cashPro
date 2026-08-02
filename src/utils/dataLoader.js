/**
 * CashPro 数据加载器 v4
 *
 * 从服务器 /data/morning/ 和 /data/evening/ 子目录动态拉取按日期命名的 JSON 文件。
 *
 * 文件命名:
 *   /data/morning/YYYY-MM-DD-morning.json  — 早盘预测 (date, summary, sentiment, bullishDirections, bearishDirections, fullReport)
 *   /data/evening/YYYY-MM-DD-evening.json  — 晚盘复盘 (date, hitResult, afterHoursSummary, marketEvents[])
 *
 * marketEvents 结构 (v4 结构化):
 *   { direction: "利好"|"利空", sector: "板块名", event: "事件描述" }
 *
 * 返回结构:
 * {
 *   latest: { date, summary, sentiment, bullishDirections, bearishDirections, hitResult, afterHoursSummary, fullReport },
 *   history: [ 同上, ... ],
 *   events: [ { date, title, tag }, ... ]
 * }
 */

/* ─── 日期工具 ──────────────────────────── */

function pad(n) { return String(n).padStart(2, '0') }

/** Date → 'YYYY-MM-DD' */
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天 'YYYY-MM-DD' */
function todayStr() { return fmtDate(new Date()) }

/* ─── URL 构建 ──────────────────────────── */

const DATA_BASE = import.meta.env.VITE_DATA_BASE || ''

function morningURL(date) { return `${DATA_BASE}/data/morning/${date}-morning.json` }
function eveningURL(date) { return `${DATA_BASE}/data/evening/${date}-evening.json` }

/* ─── 缓存 ────────────────────────────────── */

let cachedData = null

/* ─── fetch 封装 ────────────────────────────── */

async function fetchJSON(url) {
  const resp = await fetch(url, { cache: 'no-cache' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

/* ─── 主入口 ──────────────────────────────── */

export async function loadData() {
  if (cachedData) return cachedData

  try {
    const today = todayStr()

    // 1. 拉取今日 morning + evening
    const [morning, evening] = await Promise.all([
      fetchJSON(morningURL(today)).catch(() => null),
      fetchJSON(eveningURL(today)).catch(() => null),
    ])

    const latest = buildLatest(morning || {}, evening || {})

    // 2. 并行扫描过去 30 天，构建历史数据
    const history = await buildHistory(today)

    // 3. 从 evening 解析 marketEvents → 时间线格式
    const events = buildEvents(evening || {}, today)

    cachedData = { latest, history, events }

    console.log('[CashPro] 数据加载完成:', {
      date: latest.date,
      sentiment: latest.sentiment,
      hitResult: latest.hitResult || '—',
      historyCount: history.length,
      eventsCount: events.length,
    })

    return cachedData
  } catch (err) {
    console.error('[CashPro] 数据加载失败:', err)
    throw err
  }
}

export function clearCache() { cachedData = null }

/* ─── 合并 latest ──────────────────────────── */

function buildLatest(morning, evening) {
  return {
    date:              morning.date || evening.date || '',
    summary:           morning.summary || '',
    sentiment:         morning.sentiment || '中性',
    bullishDirections: morning.bullishDirections || [],
    bearishDirections: morning.bearishDirections || [],
    hitResult:         evening.hitResult || '',
    afterHoursSummary: evening.afterHoursSummary || '',
    fullReport:        morning.fullReport || '',
  }
}

/* ─── 历史数据扫描（过去 30 天并行 fetch）────── */

async function buildHistory(todayDate) {
  const now = new Date()
  const tasks = []

  for (let i = 1; i <= 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = fmtDate(d)

    tasks.push(
      Promise.all([
        fetchJSON(morningURL(date)).catch(() => null),
        fetchJSON(eveningURL(date)).catch(() => null),
      ]).then(([m, e]) => ({ date, morning: m, evening: e }))
    )
  }

  const results = await Promise.all(tasks)

  return results
    .filter(r => r.morning && r.evening)
    .map(r => ({
      date:              r.date,
      summary:           r.morning.summary || '',
      sentiment:         r.morning.sentiment || '中性',
      bullishDirections: r.morning.bullishDirections || [],
      bearishDirections: r.morning.bearishDirections || [],
      hitResult:         r.evening.hitResult || '',
      afterHoursSummary: r.evening.afterHoursSummary || '',
    }))
}

/* ─── marketEvents → 时间线格式 ─────────────── */
/*  v4: 事件从字符串升级为结构化对象 { direction, sector, event }
    时间线 tag 格式: "利空 · 出口" / "利好 · 医药" / "中性 · 宏观"  */

function buildEvents(evening, date) {
  const raw = evening.marketEvents || []

  return raw.map(item => {
    // 兼容旧格式: 如果是字符串，用关键词解析
    if (typeof item === 'string') {
      return parseLegacyEvent(item, evening.date || date)
    }

    // 新格式: { direction, sector, event }
    const direction = item.direction || ''
    const sector    = item.sector    || ''
    const event     = item.event     || ''

    // 组装 tag: "利好 · 半导体" / "利空 · 新能源"
    const tag = [direction, sector].filter(Boolean).join(' · ') || '市场事件'

    return {
      date:  evening.date || date,
      title: event,
      tag,
    }
  })
}

/** 兼容旧版字符串格式: "可能利空出口板块：美国对华新能源车加征关税..." */
function parseLegacyEvent(text, date) {
  let direction = ''
  if (text.includes('利好')) direction = '利好'
  else if (text.includes('利空')) direction = '利空'

  // 提取板块: "可能利空出口板块" → "出口"
  const sectorMatch = text.match(/(?:利好|利空)\s*([^板块：:]*)/)
  const sector = sectorMatch ? sectorMatch[1].trim() : ''

  // 提取事件正文: 冒号后面的部分
  const eventMatch = text.match(/[：:]\s*(.+)/)
  const event = eventMatch ? eventMatch[1].trim() : text

  const tag = [direction, sector].filter(Boolean).join(' · ') || '市场事件'

  return { date, title: event, tag }
}

/* ─── 散户情绪 ──────────────────────────────── */

export function sentimentLabel(s) {
  const m = { '乐观': '乐观', '悲观': '悲观', '中性': '中性', '谨慎': '谨慎' }
  return m[s] || s || '未知'
}

export function sentimentClass(s) {
  const m = { '乐观': 'sentiment-bullish', '悲观': 'sentiment-bearish', '中性': 'sentiment-neutral', '谨慎': 'sentiment-neutral' }
  return m[s] || 'sentiment-neutral'
}

export function sentimentIcon(s) {
  const m = { '乐观': '📈', '悲观': '📉', '中性': '📊', '谨慎': '📊' }
  return m[s] || '📊'
}

export function sentimentTextClass(s) {
  const m = { '乐观': 'bullish-text', '悲观': 'bearish-text', '中性': 'neutral-text', '谨慎': 'neutral-text' }
  return m[s] || ''
}

/* ─── 命中结果 ──────────────────────────────── */

export function hitResultLabel(r) {
  const m = { '准确命中': '准确命中', '小幅偏差': '小幅偏差', '明显偏差': '明显偏差' }
  return m[r] || r || '—'
}

export function hitResultClass(r) {
  const m = { '准确命中': 'hit-yes', '小幅偏差': 'hit-partial', '明显偏差': 'hit-deviation' }
  return m[r] || ''
}

export function hitResultColor(r) {
  const m = { '准确命中': '#3A7BD5', '小幅偏差': '#D9B44A', '明显偏差': '#5A6C8A' }
  return m[r] || '#5A6C8A'
}

export function hitResultDescription(r) {
  const m = {
    '准确命中': '方向完全正确，利好/利空板块走势与预期一致。',
    '小幅偏差': '大方向正确，但部分板块涨跌幅度或节奏存在偏差。',
    '明显偏差': '方向判断错误，板块涨跌与预期明显不符。',
  }
  return m[r] || ''
}
