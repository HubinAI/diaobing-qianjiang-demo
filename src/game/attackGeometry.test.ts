import { describe, expect, it } from 'vitest'
import { attackShapeConfig } from '../config/gameConfig'
import { getTargetsInAttackArea } from './attackGeometry'
import type { AttackGeometry, EnemyUnit } from '../types/game'

function enemy(id: string, pathId: EnemyUnit['pathId'], progress: number, enemyType: EnemyUnit['enemyType'] = 'normal'): EnemyUnit {
  return {
    id,
    enemyType,
    targetSide: pathId.startsWith('ghost') ? 'ghost' : 'player',
    entrySide: pathId.endsWith('right') ? 'right' : 'left',
    lane: pathId.endsWith('right') ? 'right' : 'left',
    corridor: pathId.endsWith('right') ? 'right' : 'left',
    pathId,
    hp: 100,
    maxHp: 100,
    speed: 0,
    gateDamage: 1,
    coinReward: 1,
    progress,
  }
}

describe('AttackGeometry target selection', () => {
  it('uses archer circle range and caps ordinary attacks at one target', () => {
    const geometry: AttackGeometry = {
      shape: 'circle',
      origin: { x: 0.105, y: 0.67 },
      facingAngleDeg: 0,
      radiusRatio: attackShapeConfig.archer.radiusRatio,
      maxTargets: attackShapeConfig.archer.maxTargets,
    }

    const targets = getTargetsInAttackArea(
      [
        enemy('normal-inside', 'player-left', 0.2),
        enemy('boss-inside', 'player-left', 0.2, 'boss'),
        enemy('outside', 'player-right', 0.2),
      ],
      geometry,
    )

    expect(targets).toHaveLength(1)
    expect(targets[0].enemy.id).toBe('boss-inside')
  })

  it('uses spear strip direction, side exclusion, max target count, and near-to-far order', () => {
    const geometry: AttackGeometry = {
      shape: 'strip',
      origin: { x: 0.08, y: 0.5 },
      facingAngleDeg: 0,
      lengthRatio: attackShapeConfig.spear.lengthRatio,
      widthRatio: attackShapeConfig.spear.widthRatio,
      maxTargets: attackShapeConfig.spear.maxTargets,
    }

    const targets = getTargetsInAttackArea(
      [
        enemy('in-4', 'player-left', 0.24),
        enemy('in-1', 'player-left', 0.1),
        enemy('side-out', 'player-right', 0.1),
        enemy('in-2', 'player-left', 0.14),
        enemy('in-5', 'player-left', 0.28),
        enemy('in-3', 'player-left', 0.18),
      ],
      geometry,
    )

    expect(targets.map((target) => target.enemy.id)).toEqual(['in-1', 'in-2', 'in-3', 'in-4'])
  })

  it('uses blade arc direction, excludes enemies behind, and caps at six targets', () => {
    const geometry: AttackGeometry = {
      shape: 'arc',
      origin: { x: 0.55, y: 0.54 },
      facingAngleDeg: 0,
      arcRadiusRatio: 0.22,
      arcAngleDeg: attackShapeConfig.blade.arcAngleDeg,
      maxTargets: attackShapeConfig.blade.maxTargets,
    }

    const targets = getTargetsInAttackArea(
      [
        enemy('front-1', 'player-right', 0.34),
        enemy('front-2', 'player-right', 0.34),
        enemy('front-3', 'player-right', 0.34),
        enemy('front-4', 'player-right', 0.34),
        enemy('front-5', 'player-right', 0.34),
        enemy('front-6', 'player-right', 0.34),
        enemy('front-7', 'player-right', 0.34),
        enemy('behind', 'player-left', 0.34),
      ],
      geometry,
    )

    expect(targets).toHaveLength(6)
    expect(targets.some((target) => target.enemy.id === 'behind')).toBe(false)
  })
})
