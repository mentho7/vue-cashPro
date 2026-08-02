<template>
  <section id="review" class="section">
    <div class="section-header">
      <div class="section-tag">
        <div class="section-tag-line"></div>
        <span class="section-tag-label">市场复盘与命中验证</span>
      </div>
      <h2 class="section-title">{{ data.date }} 复盘报告</h2>
      <p class="section-sub">全面复盘上一日 A 股走势，结合预测方向验证命中结果，提炼盘后关键总结。</p>
    </div>

    <div class="review-grid-triple">
      <div class="review-card-triple">
        <div class="review-card-triple-top accent-blue"></div>
        <div class="review-card-triple-icon icon-blue">走势</div>
        <h3 class="review-card-triple-title">市场走势回顾</h3>
        <p class="review-card-triple-text">{{ data.summary }}</p>
      </div>

      <div class="review-card-triple">
        <div class="review-card-triple-top accent-gold"></div>
        <div class="review-card-triple-icon icon-gold">方向</div>
        <h3 class="review-card-triple-title">方向判断验证</h3>
        <div :class="hitResultClass(data.hitResult)" class="hit-badge-lg review-hit-center">
          <span class="hit-badge-icon">{{ hitIcon(data.hitResult) }}</span>
          <span class="hit-badge-text">{{ hitResultLabel(data.hitResult) || '—' }}</span>
        </div>
        <p v-if="data.hitResult" class="review-card-triple-text">{{ hitDesc(data.hitResult) }}</p>
        <p v-else class="review-card-triple-text">盘后数据尚未更新，命中结果将在盘后总结文件上传后自动展示。</p>
      </div>

      <div class="review-card-triple">
        <div class="review-card-triple-top accent-green"></div>
        <div class="review-card-triple-icon icon-green">综合</div>
        <h3 class="review-card-triple-title">综合要点提炼</h3>
        <p v-if="data.afterHoursSummary" class="review-card-triple-text">{{ data.afterHoursSummary }}</p>
        <p v-else class="review-card-triple-text">盘后总结数据尚未更新。请在上传盘后 MD 文件时补充「盘后总结」字段。市场有风险，数据仅供参考。</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import {hitResultClass, hitResultDescription, hitResultLabel} from '../utils/dataLoader.js'

defineProps({ data: { type: Object, required: true } })

function hitIcon(r) {
  const m = { '准确命中': '✓', '小幅偏差': '≈', '明显偏差': '✗' }
  return m[r] || '—'
}

function hitDesc(r) {
  return hitResultDescription(r)
}
</script>
