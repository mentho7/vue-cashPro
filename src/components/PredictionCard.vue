<template>
  <section id="prediction" class="section">
    <div class="section-header">
      <div class="section-tag">
        <div class="section-tag-line"></div>
        <span class="section-tag-label">次日交易观点预测</span>
      </div>
      <h2 class="section-title">{{ data.date }} 交易观点</h2>
      <p class="section-sub">基于散户情绪与板块资金流向，洞察多空方向。</p>
    </div>

    <div class="card card-clickable" @click="$emit('open-doc')">
      <div class="pred-grid">
        <!-- 散户情绪 -->
        <div class="pred-block">
          <span class="pred-block-label">散户情绪</span>
          <div :class="sentimentClass(data.sentiment)" class="sentiment-indicator">
            <span class="sentiment-icon">{{ sentimentIcon(data.sentiment) }}</span>
            <span class="sentiment-text">{{ sentimentLabel(data.sentiment) }}</span>
          </div>
        </div>

        <!-- 利好方向 -->
        <div class="pred-block">
          <span class="pred-block-label">利好方向</span>
          <div class="dir-tags">
            <span v-for="dir in data.bullishDirections" :key="dir" class="dir-tag dir-tag-bullish">{{ dir }}</span>
            <span v-if="!data.bullishDirections?.length" class="dir-tag dir-tag-empty">暂无</span>
          </div>
        </div>

        <!-- 利空方向 -->
        <div class="pred-block">
          <span class="pred-block-label">利空方向</span>
          <div class="dir-tags">
            <span v-for="dir in data.bearishDirections" :key="dir" class="dir-tag dir-tag-bearish">{{ dir }}</span>
            <span v-if="!data.bearishDirections?.length" class="dir-tag dir-tag-empty">暂无</span>
          </div>
        </div>
      </div>

      <!-- 总结原文 -->
      <div class="pred-summary">
        <span class="pred-summary-label">观点摘要</span>
        <p class="pred-summary-text">{{ data.summary }}</p>
      </div>

      <!-- 点击提示 -->
      <div class="card-click-hint">
        <svg class="hint-icon" fill="none" viewBox="0 0 16 16">
          <path d="M8 3v8M4 8l4 4 4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
        </svg>
        <span>点击查看完整盘前计划</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import {sentimentClass, sentimentIcon, sentimentLabel} from '../utils/dataLoader.js'

defineProps({ data: { type: Object, required: true } })
defineEmits(['open-doc'])
</script>
