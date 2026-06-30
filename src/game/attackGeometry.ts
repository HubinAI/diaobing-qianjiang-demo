import { attackShapeConfig, gameConfig, generalConfig } from '../config/gameConfig'
import { samplePath } from './paths'
import type { AttackGeometry, BoardUnit, EnemyUnit, GameState, TroopType, WorldPoint } from '../types/game'

export interface AttackTarget {
  enemy: EnemyUnit
  point: WorldPoint
  forward: number
  side: number
  distance: number
  angleDeg: number
}

export function troopTypeForUnit(unit: BoardUnit): TroopType {
  return unit.kind === 'troop' ? unit.troopType : generalConfig[unit.generalId].troopType
}

export function getUnitSlot(state: Pick<GameState, 'slots'>, unit: BoardUnit) {
  return state.slots.find((slot) => slot.id === unit.slotId)
}

export function getAttackGeometryForUnit(state: Pick<GameState, 'slots'>, unit: BoardUnit): AttackGeometry | undefined {
  const slot = getUnitSlot(state, unit)
  if (!slot) return undefined

  const troopType = troopTypeForUnit(unit)
  const config = attackShapeConfig[troopType]
  const base = {
    shape: config.shape,
    origin: { x: slot.x, y: slot.y },
    facingAngleDeg: slot.facingAngleDeg,
    maxTargets: config.maxTargets,
  }

  if (config.shape === 'circle') {
    return { ...base, radiusRatio: config.radiusRatio }
  }
  if (config.shape === 'strip') {
    return { ...base, lengthRatio: config.lengthRatio, widthRatio: config.widthRatio }
  }
  return { ...base, arcRadiusRatio: config.arcRadiusRatio, arcAngleDeg: config.arcAngleDeg }
}

export function enemyPoint(enemy: EnemyUnit): WorldPoint {
  return samplePath(enemy.pathId, enemy.progress)
}

export function facingVector(angleDeg: number): WorldPoint {
  const radians = (angleDeg * Math.PI) / 180
  return { x: Math.cos(radians), y: Math.sin(radians) }
}

export function worldToLocal(point: WorldPoint, geometry: AttackGeometry) {
  const vector = facingVector(geometry.facingAngleDeg)
  const dx = point.x - geometry.origin.x
  const dy = (point.y - geometry.origin.y) * gameConfig.battlefieldHeightToWidthRatio
  const forward = dx * vector.x + dy * vector.y
  const side = -dx * vector.y + dy * vector.x
  return { forward, side }
}

function distanceFromLocal(forward: number, side: number) {
  return Math.sqrt(forward * forward + side * side)
}

function angleFromLocal(forward: number, side: number) {
  return Math.abs((Math.atan2(side, forward) * 180) / Math.PI)
}

function threatScore(enemy: EnemyUnit) {
  if (enemy.enemyType === 'boss') return 4
  if (enemy.enemyType === 'heavy') return 3
  if (enemy.enemyType === 'fast') return 2
  return 1
}

function compareArcherPriority(a: AttackTarget, b: AttackTarget) {
  return (
    threatScore(b.enemy) - threatScore(a.enemy) ||
    b.enemy.progress - a.enemy.progress ||
    a.enemy.hp - b.enemy.hp ||
    a.enemy.id.localeCompare(b.enemy.id)
  )
}

function compareSpearPriority(a: AttackTarget, b: AttackTarget) {
  return a.forward - b.forward || b.enemy.progress - a.enemy.progress || a.enemy.id.localeCompare(b.enemy.id)
}

function compareBladePriority(a: AttackTarget, b: AttackTarget) {
  return b.enemy.progress - a.enemy.progress || a.distance - b.distance || a.enemy.id.localeCompare(b.enemy.id)
}

export function getTargetsInAttackArea(enemies: EnemyUnit[], geometry: AttackGeometry): AttackTarget[] {
  const targets = enemies
    .map((enemy) => {
      const point = enemyPoint(enemy)
      const local = worldToLocal(point, geometry)
      const distance = distanceFromLocal(local.forward, local.side)
      return {
        enemy,
        point,
        forward: local.forward,
        side: local.side,
        distance,
        angleDeg: angleFromLocal(local.forward, local.side),
      }
    })
    .filter((target) => {
      if (geometry.shape === 'circle') {
        return target.distance <= (geometry.radiusRatio ?? 0)
      }
      if (geometry.shape === 'strip') {
        return (
          target.forward >= 0 &&
          target.forward <= (geometry.lengthRatio ?? 0) &&
          Math.abs(target.side) <= (geometry.widthRatio ?? 0) / 2
        )
      }
      return target.distance <= (geometry.arcRadiusRatio ?? 0) && target.angleDeg <= (geometry.arcAngleDeg ?? 0) / 2
    })

  if (geometry.shape === 'circle') return targets.sort(compareArcherPriority).slice(0, geometry.maxTargets)
  if (geometry.shape === 'strip') return targets.sort(compareSpearPriority).slice(0, geometry.maxTargets)
  return targets.sort(compareBladePriority).slice(0, geometry.maxTargets)
}

export function geometryData(geometry: AttackGeometry) {
  return JSON.stringify({
    shape: geometry.shape,
    origin: geometry.origin,
    facingAngleDeg: geometry.facingAngleDeg,
    radiusRatio: geometry.radiusRatio,
    lengthRatio: geometry.lengthRatio,
    widthRatio: geometry.widthRatio,
    arcRadiusRatio: geometry.arcRadiusRatio,
    arcAngleDeg: geometry.arcAngleDeg,
    maxTargets: geometry.maxTargets,
  })
}
