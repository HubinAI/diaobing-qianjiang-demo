/**
 * 自动更新版本号脚本
 * 格式：V + MMDD + NNN（月日+当日递增序号）
 * 每次运行构建时，读取当前日期，如果日期变化则序号重置为001，否则递增
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const CONFIG_PATH = resolve(process.cwd(), 'src/config/gameConfig.ts')

function getTodayStr(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${month}${day}`
}

function parseVersion(content: string): { dateStr: string; seq: number } | null {
  const match = content.match(/export const APP_VERSION = 'V(\d{4})(\d{3})'/)
  if (!match) return null
  return { dateStr: match[1], seq: parseInt(match[2], 10) }
}

function updateVersion(): void {
  const content = readFileSync(CONFIG_PATH, 'utf-8')
  const current = parseVersion(content)
  
  const todayStr = getTodayStr()
  let newSeq = 1
  
  if (current && current.dateStr === todayStr) {
    newSeq = current.seq + 1
  }
  
  const newVersion = `V${todayStr}${String(newSeq).padStart(3, '0')}`
  const newContent = content.replace(
    /export const APP_VERSION = 'V\d{7}'/,
    `export const APP_VERSION = '${newVersion}'`
  )
  
  writeFileSync(CONFIG_PATH, newContent, 'utf-8')
  console.log(`[version-bump] ${current?.dateStr === todayStr ? current.seq : 'new'} → ${newSeq} (${newVersion})`)
}

updateVersion()
