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
// 三套波次表 —— 波浪式情绪曲线
//
// 节奏设计原则：
//   波次 1-2：教学波（简单，建立信心）
//   波次 3：  首次"哇塞"——快速敌人冲击，制造紧张感
//   波次 4：  喘息波（回落，给玩家调整空间）
//   波次 5-6：压力攀升（重甲 + 快速混编）
//   波次 7：  暴风雨前的宁静（全重甲）
//   波次 8：  Boss 决战（Boss + 护卫 fast 敌人）
// ============================================================

// ---- 标准模式（类似原版，调整为波浪式节奏）----
const standardWaves: WaveSpec[] = [
  { index: 1, duration: 26, spawnInterval: 1.5, totalEnemies: 14 },
  { index: 2, duration: 28, spawnInterval: 1.3, totalEnemies: 18 },
  { index: 3, duration: 30, spawnInterval: 0.9, totalEnemies: 28, fastRatio: 0.35 },           // 首次冲击
  { index: 4, duration: 32, spawnInterval: 1.2, totalEnemies: 20 },                              // 喘息
  { index: 5, duration: 36, spawnInterval: 0.9, totalEnemies: 34, fastRatio: 0.2, heavyRatio: 0.2 },  // 压力攀升
  { index: 6, duration: 38, spawnInterval: 0.78, totalEnemies: 40, fastRatio: 0.25, heavyRatio: 0.25 }, // 持续施压
  { index: 7, duration: 40, spawnInterval: 0.9, totalEnemies: 30, heavyRatio: 0.45 },            // 全重甲
  { index: 8, duration: 50, spawnInterval: 0.85, totalEnemies: 36, fastRatio: 0.15, heavyRatio: 0.2, bossCount: 1, bossAt: 14 },
]

// ---- 简单模式（适合新手 / 教学局）----
const easyWaves: WaveSpec[] = [
  { index: 1, duration: 30, spawnInterval: 1.8, totalEnemies: 12 },
  { index: 2, duration: 32, spawnInterval: 1.5, totalEnemies: 16 },
  { index: 3, duration: 34, spawnInterval: 1.1, totalEnemies: 22, fastRatio: 0.25 },             // 首次冲击（弱化）
  { index: 4, duration: 36, spawnInterval: 1.4, totalEnemies: 18 },                              // 喘息
  { index: 5, duration: 38, spawnInterval: 1.0, totalEnemies: 28, fastRatio: 0.15, heavyRatio: 0.1 },
  { index: 6, duration: 40, spawnInterval: 0.9, totalEnemies: 32, fastRatio: 0.2, heavyRatio: 0.15 },
  { index: 7, duration: 42, spawnInterval: 1.0, totalEnemies: 24, heavyRatio: 0.35 },
  { index: 8, duration: 52, spawnInterval: 0.95, totalEnemies: 30, fastRatio: 0.1, heavyRatio: 0.15, bossCount: 1, bossAt: 16 },
]

// ---- 困难模式（适合策略玩家挑战）----
const hardWaves: WaveSpec[] = [
  { index: 1, duration: 24, spawnInterval: 1.2, totalEnemies: 18 },
  { index: 2, duration: 28, spawnInterval: 1.0, totalEnemies: 24, fastRatio: 0.15 },
  { index: 3, duration: 28, spawnInterval: 0.75, totalEnemies: 34, fastRatio: 0.4 },             // 冲击波（强化）
  { index: 4, duration: 30, spawnInterval: 1.0, totalEnemies: 22, heavyRatio: 0.15 },             // 喘息（但带重甲）
  { index: 5, duration: 34, spawnInterval: 0.75, totalEnemies: 40, fastRatio: 0.25, heavyRatio: 0.25 },
  { index: 6, duration: 36, spawnInterval: 0.68, totalEnemies: 48, fastRatio: 0.3, heavyRatio: 0.3 },
  { index: 7, duration: 38, spawnInterval: 0.78, totalEnemies: 36, heavyRatio: 0.5 },             // 全重甲地狱
  { index: 8, duration: 48, spawnInterval: 0.72, totalEnemies: 42, fastRatio: 0.2, heavyRatio: 0.25, bossCount: 1, bossAt: 10 },
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
