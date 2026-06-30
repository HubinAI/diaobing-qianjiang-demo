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
    const entry: SpawnEntry = { at: spec.bossAt ?? 12, entrySide: index % 2 === 0 ? 'left' : 'right', enemyType: 'boss' }
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

export const waves: WaveConfig[] = [
  buildWave({ index: 1, duration: 28, spawnInterval: 1.4, totalEnemies: 18 }),
  buildWave({ index: 2, duration: 32, spawnInterval: 1.15, totalEnemies: 25 }),
  buildWave({ index: 3, duration: 34, spawnInterval: 1.0, totalEnemies: 30, fastRatio: 0.2 }),
  buildWave({ index: 4, duration: 38, spawnInterval: 0.95, totalEnemies: 36, fastRatio: 0.2, heavyRatio: 0.15 }),
  buildWave({ index: 5, duration: 40, spawnInterval: 0.85, totalEnemies: 42, fastRatio: 0.25, heavyRatio: 0.18 }),
  buildWave({ index: 6, duration: 42, spawnInterval: 0.78, totalEnemies: 48, fastRatio: 0.25, heavyRatio: 0.2 }),
  buildWave({ index: 7, duration: 45, spawnInterval: 0.72, totalEnemies: 55, fastRatio: 0.28, heavyRatio: 0.22 }),
  buildWave({ index: 8, duration: 50, spawnInterval: 0.85, totalEnemies: 45, fastRatio: 0.2, heavyRatio: 0.25, bossCount: 1, bossAt: 12 }),
]
