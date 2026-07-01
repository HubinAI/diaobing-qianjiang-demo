import { gameConfig } from '../config/gameConfig'
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

export interface RoadSegment {
  start: NormalizedPoint
  end: NormalizedPoint
}

export interface RoadLayout {
  horizontal: RoadSegment
  turn: NormalizedPoint[]
  vertical: RoadSegment
}

export interface RoadClearanceConfig {
  roadVisualHalfWidth: number
  maxEnemyRadius: number
  unitVisualOverflow: number
  safetyGap: number
  cornerExtraClearance: number
  minimumRatio: number
  cornerMinimumRatio: number
  cornerInfluenceRatio: number
}

export const roadClearanceConfig: RoadClearanceConfig = {
  roadVisualHalfWidth: 16,
  maxEnemyRadius: 17,
  unitVisualOverflow: 6,
  safetyGap: 5,
  cornerExtraClearance: 5,
  minimumRatio: 0.105,
  cornerMinimumRatio: 0.118,
  cornerInfluenceRatio: 0.18,
}

function mirrorPathHorizontally(points: NormalizedPoint[]): NormalizedPoint[] {
  return points.map((point) => ({ x: 1 - point.x, y: point.y }))
}

function mirrorSegmentHorizontally(segment: RoadSegment): RoadSegment {
  return {
    start: { x: 1 - segment.start.x, y: segment.start.y },
    end: { x: 1 - segment.end.x, y: segment.end.y },
  }
}

const leftPlayerRoadLayout: RoadLayout = {
  horizontal: {
    start: { x: 0, y: 0.53 },
    end: { x: 0.27, y: 0.53 },
  },
  turn: [
    { x: 0.32, y: 0.55 },
    { x: 0.37, y: 0.6 },
    { x: 0.39, y: 0.66 },
  ],
  vertical: {
    start: { x: 0.39, y: 0.66 },
    end: { x: 0.39, y: 0.98 },
  },
}

const leftPlayerPathPoints: NormalizedPoint[] = [
  leftPlayerRoadLayout.horizontal.start,
  leftPlayerRoadLayout.horizontal.end,
  ...leftPlayerRoadLayout.turn,
  leftPlayerRoadLayout.vertical.end,
]

export const playerRoadLayouts: Record<EntrySide, RoadLayout> = {
  left: leftPlayerRoadLayout,
  right: {
    horizontal: mirrorSegmentHorizontally(leftPlayerRoadLayout.horizontal),
    turn: mirrorPathHorizontally(leftPlayerRoadLayout.turn),
    vertical: mirrorSegmentHorizontally(leftPlayerRoadLayout.vertical),
  },
}

export const playerPathPoints: Record<EntrySide, NormalizedPoint[]> = {
  left: leftPlayerPathPoints,
  right: mirrorPathHorizontally(leftPlayerPathPoints),
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

function scaledDistance(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * gameConfig.battlefieldHeightToWidthRatio)
}

export function closestPointOnSegment(point: NormalizedPoint, start: NormalizedPoint, end: NormalizedPoint) {
  const vx = end.x - start.x
  const vy = (end.y - start.y) * gameConfig.battlefieldHeightToWidthRatio
  const wx = point.x - start.x
  const wy = (point.y - start.y) * gameConfig.battlefieldHeightToWidthRatio
  const lengthSquared = vx * vx + vy * vy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared))
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

export function closestPointOnPath(point: NormalizedPoint, path: NormalizedPoint[]) {
  let closest = path[0]
  let distance = Number.POSITIVE_INFINITY
  for (let index = 0; index < path.length - 1; index += 1) {
    const candidate = closestPointOnSegment(point, path[index], path[index + 1])
    const candidateDistance = scaledDistance(point, candidate)
    if (candidateDistance < distance) {
      closest = candidate
      distance = candidateDistance
    }
  }
  return { point: closest, distance }
}

export function distancePointToPath(point: NormalizedPoint, path: NormalizedPoint[]) {
  return closestPointOnPath(point, path).distance
}

export function isNearRoadCorner(point: NormalizedPoint, pathId: EnemyPathId) {
  return enemyPaths[pathId].points.slice(1, -1).some((corner) => scaledDistance(point, corner) <= roadClearanceConfig.cornerInfluenceRatio)
}

export function requiredRoadClearanceForPoint(point: NormalizedPoint, pathId: EnemyPathId) {
  return isNearRoadCorner(point, pathId) ? roadClearanceConfig.cornerMinimumRatio : roadClearanceConfig.minimumRatio
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
