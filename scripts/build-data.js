/**
 * build-data.js — CashPro 数据构建脚本
 *
 * 用法: node scripts/build-data.js
 *
 * 流程:
 * 1. 扫描 scripts/sample-md/ 下所有 YYYYMMDD*.txt
 * 2. 解析 JSON，提取：总结、散户情绪、利好方向、利空方向、命中结果、盘后总结
 * 3. 按日期降序，取最新 7 条 → data.json
 */

import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MD_DIR = path.resolve(ROOT, 'scripts', 'sample-md')
const OUTPUT_DIR = path.resolve(ROOT, 'public', 'data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'data.json')
const MAX_FILES = 7

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/** 从文件名提取 YYYYMMDD → YYYY-MM-DD */
function parseDate(filename) {
  const m = filename.match(/^(\d{8})/)
  if (!m) return null
  const d = m[1]
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

/** 扫描 MD 目录 */
function scanFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`[build-data] MD 目录不存在: ${dir}`)
    return []
  }
  const entries = fs.readdirSync(dir)
    .filter(f => /^\d{8}.*\.txt$/i.test(f))
    .sort()
    .reverse()
  console.log(`[build-data] 扫描到 ${entries.length} 个文件`)
  return entries
}

/** 安全取文本 */
function str(val, fallback) {
  if (typeof val === 'string' && val.trim()) return val.trim()
  return fallback !== undefined ? fallback : ''
}

/** 安全取数组 */
function arr(val) {
  return Array.isArray(val) ? val : []
}

/** 解析单个文件 */
function parseFile(filepath, filename) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8').trim()
    if (!raw) { console.warn(`[build-data] 文件为空: ${filename}`); return null }
    const d = JSON.parse(raw)
    const date = parseDate(filename)
    if (!date) { console.warn(`[build-data] 无法解析日期: ${filename}`); return null }

    return {
      date,
      summary:             str(d['总结'] || d.summary),
      sentiment:           str(d['散户情绪'] || d.sentiment, '中性'),
      bullishDirections:   arr(d['利好方向'] || d.bullishDirections),
      bearishDirections:   arr(d['利空方向'] || d.bearishDirections),
      hitResult:           str(d['命中结果'] || d.hitResult, null),
      afterHoursSummary:   str(d['盘后总结'] || d.afterHoursSummary, null)
    }
  } catch (err) {
    console.error(`[build-data] 解析失败 (${filename}):`, err.message)
    return null
  }
}

function main() {
  console.log('[build-data] === CashPro 数据构建 ===')

  const files = scanFiles(MD_DIR)
  if (files.length === 0) {
    const empty = { generatedAt: new Date().toISOString(), latest: null, history: [] }
    ensureDir(OUTPUT_DIR)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(empty, null, 2), 'utf-8')
    console.log(`[build-data] 无数据 → 空 data.json`)
    return
  }

  const records = []
  for (const f of files) {
    const rec = parseFile(path.join(MD_DIR, f), f)
    if (rec) records.push(rec)
  }

  // 同一天取最后一个（当天最晚版本）
  const dateMap = new Map()
  for (const r of records) {
    if (!dateMap.has(r.date)) dateMap.set(r.date, r)
  }

  const latest = Array.from(dateMap.values()).slice(0, MAX_FILES)

  const output = {
    generatedAt: new Date().toISOString(),
    latest: latest.length > 0 ? latest[0] : null,
    history: latest.length > 1 ? latest.slice(1) : []
  }

  ensureDir(OUTPUT_DIR)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`[build-data] ✅ ${latest.length} 条 → ${OUTPUT_FILE}`)
  if (output.latest) {
    console.log(`[build-data]    最新: ${output.latest.date} | 情绪: ${output.latest.sentiment} | 命中: ${output.latest.hitResult || '—'}`)
  }
}

main()
