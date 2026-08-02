<template>
  <section id="hero" class="hero">
    <div class="hero-body">
      <div class="hero-left">
        <div class="hero-badge">
          <div class="hero-badge-dot"></div>
          <span class="hero-badge-text">{{ data.date }} 交易日观点</span>
        </div>

        <h1 class="hero-headline">
          洞察市场先机<br/>让决策更<em>清晰</em>
        </h1>

        <p class="hero-sub">{{ summaryTruncated }}</p>

        <div class="hero-actions">
          <button class="hero-cta" @click="scrollTo('prediction')">
            <svg class="hero-cta-icon" fill="none" viewBox="0 0 16 16">
              <path d="M8 3v8M4 8l4 4 4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
            </svg>
            查看交易观点
          </button>
          <div class="hero-meta">
            <div class="hero-meta-item">
              <div class="hero-meta-dot"></div>
              <span>AI 驱动</span>
            </div>
            <div class="hero-meta-item">
              <div class="hero-meta-dot"></div>
              <span>每日 09:00 / 18:00 更新</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import {computed} from 'vue'

const props = defineProps({
  data: { type: Object, required: true }
})

const summaryTruncated = computed(() => {
  return '每日盘前AI分析市场走向，精准标注利好利空方向，实时追踪预测命中，助力投资决策更清晰。'
})

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}
</script>
