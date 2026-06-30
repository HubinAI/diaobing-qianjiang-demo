import { gameConfig } from '../config/gameConfig'
import type { AttackGeometry, WorldPoint } from '../types/game'

export function localToWorldPoint(geometry: AttackGeometry, forward: number, side: number): WorldPoint {
  const radians = (geometry.facingAngleDeg * Math.PI) / 180
  const x = geometry.origin.x + forward * Math.cos(radians) - side * Math.sin(radians)
  const y = geometry.origin.y + (forward * Math.sin(radians) + side * Math.cos(radians)) / gameConfig.battlefieldHeightToWidthRatio
  return { x, y }
}

export function pointToPercent(point: WorldPoint) {
  return `${point.x * 100},${point.y * 100}`
}

export function pointStyle(point: WorldPoint) {
  return { left: `${point.x * 100}%`, top: `${point.y * 100}%` }
}

export function stripPolygonPoints(geometry: AttackGeometry) {
  const length = geometry.lengthRatio ?? 0
  const halfWidth = (geometry.widthRatio ?? 0) / 2
  return [
    localToWorldPoint(geometry, 0, -halfWidth),
    localToWorldPoint(geometry, length, -halfWidth),
    localToWorldPoint(geometry, length, halfWidth),
    localToWorldPoint(geometry, 0, halfWidth),
  ]
    .map(pointToPercent)
    .join(' ')
}

export function arcPolygonPoints(geometry: AttackGeometry, samples = 18) {
  const radius = geometry.arcRadiusRatio ?? 0
  const halfAngle = (geometry.arcAngleDeg ?? 0) / 2
  const points = [geometry.origin]

  for (let index = 0; index <= samples; index += 1) {
    const angle = -halfAngle + (halfAngle * 2 * index) / samples
    const radians = (angle * Math.PI) / 180
    points.push(localToWorldPoint(geometry, radius * Math.cos(radians), radius * Math.sin(radians)))
  }

  return points.map(pointToPercent).join(' ')
}

export function facingArrowPoints(geometry: AttackGeometry) {
  const length =
    geometry.shape === 'circle'
      ? Math.min(0.1, (geometry.radiusRatio ?? 0) * 0.42)
      : geometry.shape === 'strip'
        ? Math.min(0.12, (geometry.lengthRatio ?? 0) * 0.55)
        : Math.min(0.09, (geometry.arcRadiusRatio ?? 0) * 0.65)
  return {
    start: geometry.origin,
    end: localToWorldPoint(geometry, length, 0),
  }
}
