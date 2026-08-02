<template>
  <nav class="nav">
    <div class="nav-brand">
      <svg class="nav-brand-icon" fill="none" viewBox="0 0 30 30">
        <rect fill="url(#navGrad)" height="30" rx="7" width="30"/>
        <path d="M9 19V12L15 16L21 12V19" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/>
        <defs>
          <linearGradient id="navGrad" x1="0" x2="30" y1="0" y2="30">
            <stop offset="0%" stop-color="#2C63E6"/>
            <stop offset="100%" stop-color="#4A80F0"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="nav-brand-text">CashPro</span>
    </div>

    <button :class="{ open: menuOpen }" aria-label="菜单" class="nav-toggle" @click="menuOpen = !menuOpen">
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
    </button>

    <div :class="{ open: menuOpen }" class="nav-links">
      <a class="nav-link" href="#hero" @click="menuOpen = false">首页</a>
      <a class="nav-link" href="#prediction" @click="menuOpen = false">交易观点</a>
      <a class="nav-link" href="#review" @click="menuOpen = false">复盘</a>
      <a class="nav-link" href="#history" @click="menuOpen = false">历史</a>
    </div>
  </nav>
</template>

<script setup>
import {ref} from 'vue'

const menuOpen = ref(false)
</script>
