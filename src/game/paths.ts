import type { EnemyPathId, EntrySide, SideId } from '../types/game'

export type NormalizedPoint = {
  x: number
  y: number
}

export interface EnemyPath {
  id: EnemyPathId
  targetSide: SideId
  entrySide: EntrySide
  label: string
  points: NormalizedPoint[]
}

export const playerPathPoints: Record<EntrySide, NormalizedPoint[]> = {
  left: [
    { x: 0, y: 0.5 },
    { x: 0.18, y: 0.5 },
    { x: 0.34, y: 0.54 },
    { x: 0.42, y: 0.62 },
    { x: 0.42, y: 0.8 },
    { x: 0.46, y: 0.92 },
    { x: 0.5, y: 0.98 },
  ],
  right: [
    { x: 1, y: 0.5 },
    { x: 0.82, y: 0.5 },
    { x: 0.66, y: 0.54 },
    { x: 0.58, y: 0.62 },
    { x: 0.58, y: 0.8 },
    { x: 0.54, y: 0.92 },
    { x: 0.5, y: 0.98 },
  ],
}

export function mirrorPathVertically(points: NormalizedPoint[]): NormalizedPoint[] {
  return points.map((point) => ({ x: point.x, y: 1 - point.y }))
}

export const enemyPaths: Record<EnemyPathId, EnemyPath> = {
  'player-left': {
    id: 'player-left',
    targetSide: 'player',
    entrySide: 'left',
    label: '我方左侧通道',
    points: playerPathPoints.left,
  },
  'player-right': {
    id: 'player-right',
    targetSide: 'player',
    entrySide: 'right',
    label: '我方右侧通道',
    points: playerPathPoints.right,
  },
  'ghost-left': {
    id: 'ghost-left',
    targetSide: 'ghost',
    entrySide: 'left',
    label: '对手左侧通道',
    points: mirrorPathVertically(playerPathPoints.left),
  },
  'ghost-right': {
    id: 'ghost-right',
    targetSide: 'ghost',
    entrySide: 'right',
    label: '对手右侧通道',
    points: mirrorPathVertically(playerPathPoints.right),
  },
}

export function pathIdFor(targetSide: SideId, entrySide: EntrySide): EnemyPathId {
  return `${targetSide}-${entrySide}`
}

export function samplePath(pathId: EnemyPathId, progress: number): NormalizedPoint {
  const path = enemyPaths[pathId]
  const clamped = Math.min(1, Math.max(0, progress))
  const scaled = clamped * (path.points.length - 1)
  const index = Math.min(path.points.length - 2, Math.floor(scaled))
  const ratio = scaled - index
  const start = path.points[index]
  const end = path.points[index + 1]
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  }
}

export function samplePathPercent(pathId: EnemyPathId, progress: number): NormalizedPoint {
  const point = samplePath(pathId, progress)
  return {
    x: point.x * 100,
    y: point.y * 100,
  }
}

export function pathPointsAttribute(pathId: EnemyPathId) {
  return enemyPaths[pathId].points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')
}

export function pathSegmentPointsAttribute(pathId: EnemyPathId, startProgress: number, endProgress: number, samples = 16) {
  const start = Math.min(1, Math.max(0, startProgress))
  const end = Math.min(1, Math.max(start, endProgress))
  return Array.from({ length: samples }, (_, index) => {
    const ratio = samples === 1 ? 0 : index / (samples - 1)
    const point = samplePath(pathId, start + (end - start) * ratio)
    return `${point.x * 100},${point.y * 100}`
  }).join(' ')
}
