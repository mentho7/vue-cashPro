<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @wheel="onOverlayWheel" @click.self="close">
        <div aria-modal="true" class="modal-container" role="dialog">
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-header-dot"></div>
              <h3 class="modal-title">{{ title }}</h3>
            </div>
            <button aria-label="关闭" class="modal-close" @click="close">&times;</button>
          </div>
          <div class="modal-body" v-html="renderedHtml"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import {computed, ref, watch} from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  docPath: { type: String, default: '' },
  rawMarkdown: { type: String, default: '' }    // 直接传入 MD 文本（优先于 docPath）
})

const emit = defineEmits(['close'])

const rawMd = ref('')
const loading = ref(false)

function close() { emit('close') }

function onOverlayWheel(e) {
  // 只有滚轮在可滚动的弹窗内容区内才放行，其余全部拦截
  const scrollable = e.target.closest('.modal-body')
  if (!scrollable) e.preventDefault()
}

/* ... (escapeHtml, inlineFormat, mdToHtml, renderTable 不变) ... */

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function mdToHtml(md) {
  const lines = md.split('\n')
  let html = ''
  let inTable = false
  let tableRows = []
  let inCodeBlock = false
  let codeLang = ''
  let codeContent = []
  let inQuote = false
  let quoteLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>\n`
        codeContent = []
        codeLang = ''
      } else {
        codeLang = line.slice(3).trim()
      }
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Empty line
    if (line.trim() === '') {
      if (inTable) {
        html += renderTable(tableRows)
        inTable = false
        tableRows = []
      }
      if (inQuote) {
        html += `<blockquote>${inlineFormat(quoteLines.join('<br>'))}</blockquote>\n`
        inQuote = false
        quoteLines = []
      }
      continue
    }

    // Table rows
    if (line.startsWith('|')) {
      if (!inTable) inTable = true
      tableRows.push(line)
      continue
    }

    // Quote
    if (line.startsWith('> ')) {
      if (!inQuote) inQuote = true
      quoteLines.push(line.slice(2))
      continue
    }

    // If we were in a table/quote and hit non-table/non-quote, flush it
    if (inTable) {
      html += renderTable(tableRows)
      inTable = false
      tableRows = []
    }
    if (inQuote) {
      html += `<blockquote>${inlineFormat(quoteLines.join('<br>'))}</blockquote>\n`
      inQuote = false
      quoteLines = []
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      html += '<hr>\n'
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      html += `<h3>${inlineFormat(line.slice(4))}</h3>\n`
      continue
    }
    if (line.startsWith('## ')) {
      html += `<h2>${inlineFormat(line.slice(3))}</h2>\n`
      continue
    }
    if (line.startsWith('# ')) {
      html += `<h1>${inlineFormat(line.slice(2))}</h1>\n`
      continue
    }

    // Regular paragraph
    html += `<p>${inlineFormat(line)}</p>\n`
  }

  // Flush remaining
  if (inTable) html += renderTable(tableRows)
  if (inQuote) html += `<blockquote>${inlineFormat(quoteLines.join('<br>'))}</blockquote>\n`

  return html
}

function renderTable(rows) {
  if (rows.length < 2) return ''
  // Filter out separator rows (|------|------|)
  const dataRows = rows.filter(r => !/^\s*\|[-\s|]+\|\s*$/.test(r))
  if (dataRows.length === 0) return ''

  let html = '<div class="md-table-wrap"><table class="md-table">\n'
  dataRows.forEach((row, idx) => {
    const cells = row.split('|').map(c => c.trim()).filter(c => c !== '')
    const tag = idx === 0 ? 'th' : 'td'
    html += '<tr>' + cells.map(c => `<${tag}>${inlineFormat(c)}</${tag}>`).join('') + '</tr>\n'
  })
  html += '</table></div>\n'
  return html
}

const title = computed(() => {
  const firstLine = (rawMd.value || '').split('\n')[0] || ''
  return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : '盘前计划'
})

const renderedHtml = computed(() => {
  if (!rawMd.value) return '<p class="modal-loading">加载中...</p>'
  return mdToHtml(rawMd.value)
})

async function loadDoc() {
  if (!props.show) return

  // 优先使用直接传入的 MD 文本
  if (props.rawMarkdown) {
    rawMd.value = props.rawMarkdown
    return
  }

  // 否则从 docPath URL 拉取
  if (!props.docPath) return
  loading.value = true
  try {
    const res = await fetch(props.docPath)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    rawMd.value = await res.text()
  } catch (e) {
    rawMd.value = `## 加载失败\n\n无法读取文档：${props.docPath}\n\n错误：${e.message}`
  } finally {
    loading.value = false
  }
}

watch(() => [props.show, props.rawMarkdown], ([showVal]) => {
  if (showVal) {
    loadDoc()
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown)
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKeydown)
  }
})

function onKeydown(e) {
  if (e.key === 'Escape') close()
}
</script>
