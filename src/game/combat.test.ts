import { describe, expect, it } from 'vitest'
import { troopConfig } from '../config/gameConfig'
import { createInitialGameState } from './engine'
import { tickCombat } from './combat'
import type { EnemyUnit, GameState } from '../types/game'

function enemy(id: string, progress: number): EnemyUnit {
  return {
    id,
    enemyType: 'normal',
    targetSide: 'player',
    entrySide: 'left',
    lane: 'left',
    corridor: 'left',
    pathId: 'player-left',
    hp: 100,
    maxHp: 100,
    speed: 0,
    gateDamage: 1,
    coinReward: 1,
    progress,
  }
}

function spearState(): GameState {
  const state = createInitialGameState('spear-trace', 'playing', 'player')
  const slot = { ...state.slots[0], id: 'test-spear-slot', x: 0.08, y: 0.5, facingAngleDeg: 0, occupantId: 'test-spear' }
  return {
    ...state,
    elapsedSeconds: 1,
    waveBreakRemaining: 10,
    slots: [slot],
    troops: {
      'test-spear': {
        id: 'test-spear',
        kind: 'troop',
        troopType: 'spear',
        star: 1,
        lane: 'left',
        slotId: slot.id,
        nextAttackAt: 0,
      },
    },
    enemies: {
      'in-1': enemy('in-1', 0.1),
      'in-2': enemy('in-2', 0.14),
      'in-3': enemy('in-3', 0.18),
      'in-4': enemy('in-4', 0.24),
      'in-5': enemy('in-5', 0.28),
    },
  }
}

describe('spear combat trace', () => {
  it('uses one ordered target list for visuals and damage resolution', () => {
    let state = tickCombat(spearState(), 0.01)
    const trace = state.attackTraces.find((candidate) => candidate.attackType === 'thrust')!
    expect(trace.geometry.shape).toBe('strip')
    expect(trace.targetEnemyIds).toEqual(['in-1', 'in-2', 'in-3', 'in-4'])
    expect(trace.targetImpacts.map((impact) => impact.enemyId)).toEqual(trace.targetEnemyIds)
    expect(trace.targetImpacts.map((impact) => impact.order)).toEqual([0, 1, 2, 3])
    expect(trace.targetImpacts.map((impact) => impact.damageRatio)).toEqual([1, 0.82, 0.68, 0.55])
    expect(trace.targetImpacts.every((impact) => impact.point.x > 0 && impact.point.y > 0)).toBe(true)

    state = tickCombat(state, 0.4)
    const hpAfterImpact = Object.fromEntries(Object.values(state.enemies).map((target) => [target.id, target.hp]))
    expect(hpAfterImpact['in-1']).toBeCloseTo(100 - troopConfig.spear.attack)
    expect(hpAfterImpact['in-2']).toBeCloseTo(100 - troopConfig.spear.attack * 0.82)
    expect(hpAfterImpact['in-3']).toBeCloseTo(100 - troopConfig.spear.attack * 0.68)
    expect(hpAfterImpact['in-4']).toBeCloseTo(100 - troopConfig.spear.attack * 0.55)
    expect(hpAfterImpact['in-5']).toBe(100)

    state = tickCombat(state, 0.1)
    expect(Object.fromEntries(Object.values(state.enemies).map((target) => [target.id, target.hp]))).toEqual(hpAfterImpact)
  })
})
