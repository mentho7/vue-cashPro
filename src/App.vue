<template>
  <div class="page">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>正在加载市场数据...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="loading-state">
      <span class="loading-error">数据加载失败：{{ error }}</span>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <NavBar />
      <HeroSection :data="data.latest" />
      <PredictionCard :data="data.latest" @open-doc="showModal = true" />
      <DailyReview :data="data.latest" />
      <HistoryTable :data="data.latest" :events="data.events" :history="data.history" />
      <FooterSection />

      <DocModal
        :raw-markdown="data.latest.fullReport"
        :show="showModal"
        @close="showModal = false"
      />
    </template>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {loadData} from './utils/dataLoader.js'
import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import DailyReview from './components/DailyReview.vue'
import PredictionCard from './components/PredictionCard.vue'
import HistoryTable from './components/HistoryTable.vue'
import FooterSection from './components/Footer.vue'
import DocModal from './components/DocModal.vue'

const data = ref(null)
const loading = ref(true)
const error = ref('')
const showModal = ref(false)

onMounted(async () => {
  try {
    data.value = await loadData()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
