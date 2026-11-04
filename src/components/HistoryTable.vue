<template>
  <section id="history" class="section">
    <div class="section-header">
      <div class="section-tag">
        <div class="section-tag-line"></div>
        <span class="section-tag-label">历史记录</span>
      </div>
      <h2 class="section-title">历史预测成功率</h2>
      <p class="section-sub">基于真实行情回溯验证，准确与偏差全部透明可查，绝不含糊。</p>
    </div>

    <!-- ============ 双卡片行：环形图 + 时间线 ============ -->
    <div v-if="history.length" class="charts-row">
      <!-- 左侧：周度预测成功率环形图（截图风格） -->
      <div class="chart-card chart-pie-hit">
        <div class="chart-card-header">
          <div class="chart-title">周度预测成功率</div>
          <div class="chart-subtitle">{{ dateRange }} · 共 {{ history.length }} 个交易日</div>
        </div>

        <div class="donut-chart-wrap">
          <!-- 环形图：粗线条、截图风格 -->
          <svg class="donut-svg" viewBox="0 0 200 200">
            <!-- 背景环 -->
            <circle cx="100" cy="100" fill="none" r="70" stroke="rgba(255,255,255,0.08)" stroke-width="24" />
            <!-- 数据段：stroke-dasharray 方式 -->
            <circle
              v-for="seg in donutSegments"
              :key="seg.label"
              :stroke="seg.color" :stroke-dasharray="seg.dashArray" :stroke-dashoffset="seg.dashOffset"
              class="donut-segment"
              cx="100"
              cy="100"
              fill="none"
              r="70"
              stroke-linecap="round"
              stroke-width="24"
              transform="rotate(-90 100 100)"
            />
            <!-- 中心文字 -->
            <text fill="#F2F5FA" font-size="28" font-weight="800" text-anchor="middle" x="100" y="94">
              {{ accuratePct }}%
            </text>
            <text fill="#6A7892" font-size="10" text-anchor="middle" x="100" y="118">
              准确命中率
            </text>
          </svg>

          <!-- 右侧图例 -->
          <div class="chart-legend compact">
            <div v-for="item in pieStats" :key="item.label" class="chart-legend-item">
              <div :style="{ background: item.color }" class="chart-legend-dot"></div>
              <span class="chart-legend-name">{{ item.label }}</span>
              <span class="chart-legend-val">{{ item.pct.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：最近事件时间线 -->
      <div class="chart-card chart-timeline">
        <div class="chart-card-header">
          <div class="chart-title">未来市场事件</div>
          <div class="chart-subtitle">未来 5 条重大市场事件</div>
        </div>

        <div class="timeline-body">
          <div class="timeline-line"></div>
          <div
            v-for="(evt, i) in events.slice(0, 5)"
            :key="i"
            class="timeline-item"
          >
            <div :style="{ background: timelineDotColor(i) }" class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-date">{{ evt.date }}</div>
              <div class="timeline-title">{{ evt.title }}</div>
              <span :style="{ color: timelineTagColor(evt.tag), background: timelineTagBg(evt.tag) }" class="timeline-tag">
                {{ evt.tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div v-if="history.length" class="table-shell">
      <div class="table-head">
        <span class="table-th">日期</span>
        <span class="table-th">情绪</span>
        <span class="table-th">观点摘要</span>
        <span class="table-th">利好方向</span>
        <span class="table-th">利空方向</span>
        <span class="table-th">命中结果</span>
        <span class="table-th">盘后总结</span>
      </div>

      <div class="table-body">
        <div
          v-for="row in rows"
          :key="row.date"
          class="table-row table-row-clickable"
          role="button"
          tabindex="0"
          :title="row.fullReport ? '点击查看当日完整盘前计划' : '当日暂无完整报告'"
          @click="openDoc(row)"
          @keydown.enter="openDoc(row)"
          @keydown.space.prevent="openDoc(row)"
        >
          <span class="table-td table-td-date">{{ row.date }}</span>
          <span :class="sentimentTextClass(row.sentiment)" class="table-td table-td-sentiment">
            {{ sentimentLabel(row.sentiment) }}
          </span>
          <span class="table-td table-td-summary">{{ row._summary }}</span>
          <span class="table-td table-td-tags">
            <span v-for="d in row._bullish" :key="d" class="table-tag-inline dir-tag-bullish">{{ d }}</span>
          </span>
          <span class="table-td table-td-tags">
            <span v-for="d in row._bearish" :key="d" class="table-tag-inline dir-tag-bearish">{{ d }}</span>
          </span>
          <span :class="hitResultClass(row.hitResult)" class="table-td table-td-hit">
            {{ hitResultLabel(row.hitResult) }}
          </span>
          <span class="table-td table-td-after">{{ row._after || '—' }}</span>
        </div>
      </div>

      <div class="table-footer">
        * AI 分析仅供参考，不构成投资建议。市场有风险，投资需谨慎。
      </div>
    </div>

    <div v-else class="card">
      <div class="review-body">暂无历史数据</div>
    </div>
  </section>
</template>

<script setup>
import {computed} from 'vue'
import {hitResultClass, hitResultLabel, sentimentLabel, sentimentTextClass} from '../utils/dataLoader.js'

const props = defineProps({
  data: { type: Object, required: true },
  history: { type: Array, required: true },
  events: { type: Array, default: () => [] }
})

const emit = defineEmits(['open-doc'])

/* ── 行点击：打开当日完整盘前计划 ───────────── */
function openDoc(row) {
  if (!row || !row.fullReport) return
  emit('open-doc', { rawMarkdown: row.fullReport, date: row.date })
}

/* ── 配色（截图风格固定配色）────────────────── */
const COLORS = {
  '准确命中': '#3A7BD5',  // 主蓝色
  '小幅偏差': '#D9B44A',  // 金色/黄色
  '明显偏差': '#5A6C8A'   // 暗灰蓝
}

/* ── 表格行 ────────────────────────────── */
const rows = computed(() =>
  (props.history || []).map(item => ({
    ...item,
    _summary: (item.summary || '').length > 40
      ? item.summary.slice(0, 40) + '...'
      : (item.summary || ''),
    _bullish: (item.bullishDirections || []).slice(0, 3),
    _bearish: (item.bearishDirections || []).slice(0, 3),
    _after: item.afterHoursSummary
      ? (item.afterHoursSummary.length > 40
        ? item.afterHoursSummary.slice(0, 40) + '...'
        : item.afterHoursSummary)
      : null
  }))
)

/* ── 日期范围 ──────────────────────────── */
const dateRange = computed(() => {
  const h = props.history
  if (!h.length) return ''
  return h[h.length - 1].date + ' — ' + h[0].date
})

/* ═══════════════════════════════════════════
   环形图：周度预测成功率
   分类：准确命中 / 小幅偏差 / 明显偏差
   ═══════════════════════════════════════════ */
const CATEGORIES = ['准确命中', '小幅偏差', '明显偏差']
const pieTotal = computed(() => props.history.length)

// 映射 hitResult → 三分类（兼容旧值）
function mapToCategory(hitResult) {
  if (CATEGORIES.includes(hitResult)) return hitResult
  // 兼容旧数据：命中 → 准确命中，部分命中 → 小幅偏差，其余 → 明显偏差
  if (hitResult === '命中') return '准确命中'
  if (hitResult === '部分命中') return '小幅偏差'
  return '明显偏差'
}

const pieStats = computed(() => {
  const counts = {}
  CATEGORIES.forEach(c => { counts[c] = 0 })
  props.history.forEach(row => {
    const cat = mapToCategory(row.hitResult)
    if (counts.hasOwnProperty(cat)) counts[cat]++
  })
  const total = pieTotal.value || 1
  return CATEGORIES.map(label => ({
    label,
    count: counts[label],
    pct: (counts[label] / total) * 100,
    color: COLORS[label]
  }))
})

// 准确命中率（中心展示）
const accuratePct = computed(() => {
  const acc = pieStats.value.find(s => s.label === '准确命中')
  return acc ? acc.pct.toFixed(1) : '0.0'
})

// 环形图 stroke-dasharray 方式：周长 = 2*PI*70 ≈ 440
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 70

const donutSegments = computed(() => {
  const stats = pieStats.value
  let cumulative = 0
  return stats.filter(seg => seg.count > 0).map(seg => {
    const fraction = seg.count / pieTotal.value
    const dashLen = fraction * DONUT_CIRCUMFERENCE
    const gapLen = DONUT_CIRCUMFERENCE - dashLen
    const dashOffset = -cumulative * DONUT_CIRCUMFERENCE
    cumulative += fraction

    return {
      label: seg.label,
      color: seg.color,
      dashArray: `${dashLen.toFixed(2)} ${gapLen.toFixed(2)}`,
      dashOffset: dashOffset.toFixed(2)
    }
  })
})

/* ═══════════════════════════════════════════
   时间线颜色
   ═══════════════════════════════════════════ */
const TIMELINE_COLORS = ['#2C63E6', '#C7A86A', '#16B981', '#F2545B', '#40C7DC']
function timelineDotColor(i) { return TIMELINE_COLORS[i % TIMELINE_COLORS.length] }

const TAG_PALETTE = {
  '利好': { text: '#16B981', bg: 'rgba(22,185,129,0.12)' },
  '利空': { text: '#F2545B', bg: 'rgba(242,84,91,0.12)' },
  '默认': { text: '#7FB0FF', bg: 'rgba(127,176,255,0.10)' }
}
function timelineTagColor(tag) {
  if (tag.includes('利好')) return TAG_PALETTE['利好'].text
  if (tag.includes('利空')) return TAG_PALETTE['利空'].text
  return TAG_PALETTE['默认'].text
}
function timelineTagBg(tag) {
  if (tag.includes('利好')) return TAG_PALETTE['利好'].bg
  if (tag.includes('利空')) return TAG_PALETTE['利空'].bg
  return TAG_PALETTE['默认'].bg
}
</script>

<style scoped>
.table-row-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.table-row-clickable:hover { background-color: rgba(127,176,255,0.06); }
.table-row-clickable:focus-visible {
  outline: 2px solid rgba(127,176,255,0.45);
  outline-offset: -2px;
}
</style>
