import type { EnemyType, EntrySide } from '../types/game'

export interface SpawnEntry {
  at: number
  entrySide: EntrySide
  enemyType: EnemyType
}

export interface WaveConfig {
  index: number
  duration: number
  spawnInterval: number
  spawnQueue: SpawnEntry[]
  lanes: Record<EntrySide, Partial<Record<EnemyType, number>>>
}

interface WaveSpec {
  index: number
  duration: number
  spawnInterval: number
  totalEnemies: number
  fastRatio?: number
  heavyRatio?: number
  bossCount?: number
  bossAt?: number
}

const lanes: EntrySide[] = ['left', 'right']

function pushCount(counts: Record<EntrySide, Partial<Record<EnemyType, number>>>, lane: EntrySide, enemyType: EnemyType) {
  counts[lane][enemyType] = (counts[lane][enemyType] ?? 0) + 1
}

function enemyTypeFor(order: number, normalCount: number, fastCount: number, heavyCount: number): EnemyType {
  if (heavyCount > 0 && order % Math.max(2, Math.floor((normalCount + fastCount + heavyCount) / heavyCount)) === 0) {
    return 'heavy'
  }
  if (fastCount > 0 && order % Math.max(2, Math.floor((normalCount + fastCount + heavyCount) / fastCount)) === 1) {
    return 'fast'
  }
  return 'normal'
}

function buildWave(spec: WaveSpec): WaveConfig {
  const bossCount = spec.bossCount ?? 0
  const nonBossCount = spec.totalEnemies - bossCount
  const fastCount = Math.round(nonBossCount * (spec.fastRatio ?? 0))
  const heavyCount = Math.round(nonBossCount * (spec.heavyRatio ?? 0))
  const normalCount = Math.max(0, nonBossCount - fastCount - heavyCount)
  const counts: Record<EntrySide, Partial<Record<EnemyType, number>>> = { left: {}, right: {} }
  const spawnQueue: SpawnEntry[] = []

  for (let index = 0; index < nonBossCount; index += 1) {
    const lane = lanes[index % lanes.length]
    const enemyType = enemyTypeFor(index, normalCount, fastCount, heavyCount)
    spawnQueue.push({ at: Number((index * spec.spawnInterval).toFixed(2)), entrySide: lane, enemyType })
    pushCount(counts, lane, enemyType)
  }

  for (let index = 0; index < bossCount; index += 1) {
    const bossEntryAt = spec.bossAt ?? 12
    // 在 boss 前插入一波 fast 敌人制造"护送 boss"的紧张感
    if (index === 0 && bossCount > 0) {
      const escortLane = index % 2 === 0 ? 'left' : 'right'
      const escortCount = 3
      for (let e = 0; e < escortCount; e += 1) {
        spawnQueue.push({
          at: Number((bossEntryAt - 1.5 + e * 0.5).toFixed(2)),
          entrySide: e % 2 === 0 ? 'left' : 'right',
          enemyType: 'fast',
        })
        pushCount(counts, e % 2 === 0 ? 'left' : 'right', 'fast')
      }
    }
    const entry: SpawnEntry = { at: bossEntryAt, entrySide: index % 2 === 0 ? 'left' : 'right', enemyType: 'boss' }
    spawnQueue.push(entry)
    pushCount(counts, entry.entrySide, entry.enemyType)
  }

  spawnQueue.sort((a, b) => a.at - b.at)

  return {
    index: spec.index,
    duration: spec.duration,
    spawnInterval: spec.spawnInterval,
    spawnQueue,
    lanes: counts,
  }
}

// ============================================================
// 三套波次表 —— 赵云与阿斗式波浪心流
//
// 节奏设计原则（赵云单骑救主关卡心流）：
//   波次 1-2：教学/准备波（敌军稀少、节奏缓慢，玩家积累经济部署阵容）
//   波次 3：  初次试探——少量快速兵，检验基础防线
//   波次 4：  喘息波——回复经济，重甲初现但数量极少
//   波次 5-6：压力攀升——重甲+快速混编，但间隔保持可控
//   波次 7：  暴风雨前奏——重甲阵 + 快速护卫
//   波次 8：  Boss 决战——Boss + 护卫，检验全部阵容
//
// 核心改动（相较原版）：
//   - 前期敌军数量↓30-40%，spawn间隔↑（更慢的出兵节奏）
//   - 快速兵推迟到第3波才出现，且比例降低
//   - 重甲推迟到第4波才出现
//   - 波次间休息从4秒增至6秒
//   - 敌军成长倍率从35%/波降至25%/波（避免后期数值爆炸）
// ============================================================

// ---- 标准模式 ----
const standardWaves: WaveSpec[] = [
  // 波次1：教学波——极少量步卒，给足准备时间
  { index: 1, duration: 30, spawnInterval: 2.0, totalEnemies: 12 },
  // 波次2：基础波——少量步卒，节奏略加快
  { index: 2, duration: 32, spawnInterval: 1.6, totalEnemies: 18 },
  // 波次3：初次试探——引入快速兵（低比例）
  { index: 3, duration: 32, spawnInterval: 1.2, totalEnemies: 24, fastRatio: 0.2 },
  // 波次4：喘息波——重甲初现（极少），给玩家调整窗口
  { index: 4, duration: 34, spawnInterval: 1.4, totalEnemies: 22, heavyRatio: 0.08 },
  // 波次5：压力攀升——快速+重甲混编
  { index: 5, duration: 36, spawnInterval: 1.0, totalEnemies: 34, fastRatio: 0.2, heavyRatio: 0.15 },
  // 波次6：持续高压——混编比例提升
  { index: 6, duration: 38, spawnInterval: 0.85, totalEnemies: 44, fastRatio: 0.25, heavyRatio: 0.22 },
  // 波次7：暴风雨前奏——重甲阵+快速护卫
  { index: 7, duration: 40, spawnInterval: 0.9, totalEnemies: 38, heavyRatio: 0.45, fastRatio: 0.12 },
  // 波次8：Boss决战
  { index: 8, duration: 54, spawnInterval: 0.8, totalEnemies: 46, fastRatio: 0.15, heavyRatio: 0.22, bossCount: 1, bossAt: 14 },
]

// ---- 简单模式 ----
const easyWaves: WaveSpec[] = [
  // 波次1：教学波——极少量步卒，超长间隔
  { index: 1, duration: 34, spawnInterval: 2.5, totalEnemies: 10 },
  // 波次2：基础波——纯步卒，缓慢节奏
  { index: 2, duration: 36, spawnInterval: 2.0, totalEnemies: 14 },
  // 波次3：初次试探——低比例快速兵
  { index: 3, duration: 36, spawnInterval: 1.5, totalEnemies: 20, fastRatio: 0.15 },
  // 波次4：喘息波——极少重甲
  { index: 4, duration: 38, spawnInterval: 1.6, totalEnemies: 18, heavyRatio: 0.05 },
  // 波次5：压力攀升
  { index: 5, duration: 40, spawnInterval: 1.2, totalEnemies: 28, fastRatio: 0.15, heavyRatio: 0.1 },
  // 波次6：持续高压
  { index: 6, duration: 42, spawnInterval: 1.0, totalEnemies: 34, fastRatio: 0.2, heavyRatio: 0.15 },
  // 波次7：重甲阵
  { index: 7, duration: 44, spawnInterval: 1.1, totalEnemies: 30, heavyRatio: 0.35, fastRatio: 0.1 },
  // 波次8：Boss决战
  { index: 8, duration: 58, spawnInterval: 0.95, totalEnemies: 36, fastRatio: 0.1, heavyRatio: 0.15, bossCount: 1, bossAt: 16 },
]

// ---- 困难模式 ----
const hardWaves: WaveSpec[] = [
  // 波次1：教学波——少量步卒（但比 easy/standard 多）
  { index: 1, duration: 26, spawnInterval: 1.8, totalEnemies: 16 },
  // 波次2：基础波——开始有少量快速兵
  { index: 2, duration: 28, spawnInterval: 1.3, totalEnemies: 22, fastRatio: 0.08 },
  // 波次3：首次冲击——快速兵比例提升
  { index: 3, duration: 28, spawnInterval: 0.9, totalEnemies: 32, fastRatio: 0.3 },
  // 波次4：喘息波——重甲初现
  { index: 4, duration: 30, spawnInterval: 1.2, totalEnemies: 24, heavyRatio: 0.12 },
  // 波次5：压力攀升
  { index: 5, duration: 34, spawnInterval: 0.8, totalEnemies: 42, fastRatio: 0.25, heavyRatio: 0.2 },
  // 波次6：持续高压
  { index: 6, duration: 36, spawnInterval: 0.68, totalEnemies: 52, fastRatio: 0.3, heavyRatio: 0.28 },
  // 波次7：重甲地狱
  { index: 7, duration: 38, spawnInterval: 0.75, totalEnemies: 46, heavyRatio: 0.5, fastRatio: 0.15 },
  // 波次8：Boss决战
  { index: 8, duration: 50, spawnInterval: 0.62, totalEnemies: 54, fastRatio: 0.22, heavyRatio: 0.3, bossCount: 1, bossAt: 12 },
]

// ---- 导出 ----
export type WaveTableId = 'easy' | 'standard' | 'hard'
export const waveTableIds: WaveTableId[] = ['easy', 'standard', 'hard']

const waveCache: Record<WaveTableId, WaveConfig[]> = {
  easy: easyWaves.map(buildWave),
  standard: standardWaves.map(buildWave),
  hard: hardWaves.map(buildWave),
}

export function getWaveTable(id: WaveTableId): WaveConfig[] {
  return waveCache[id]
}

export function pickRandomWaveTable(rngState: number): { table: WaveConfig[]; tableId: WaveTableId; rngState: number } {
  // 简单的 xorshift 风格随机
  let state = rngState + 0x6d2b79f5
  state = Math.imul(state ^ (state >>> 15), state | 1)
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
  const value = ((state ^ (state >>> 14)) >>> 0) / 4294967296
  const index = Math.min(waveTableIds.length - 1, Math.floor(value * waveTableIds.length))
  const tableId = waveTableIds[index]
  return { table: waveCache[tableId], tableId, rngState: state >>> 0 }
}

// 向后兼容：默认使用标准波次表
export const waves: WaveConfig[] = standardWaves.map(buildWave)
