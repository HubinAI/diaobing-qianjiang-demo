import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './engine'
import { buildRecruitCategoryWeights, drawRecruitBatch, drawRecruitItem, getAvailableWeapons } from './randomPool'
import type { GameState, GeneralId, GeneralUnit, ReserveItem, WeaponId } from '../types/game'

const generalSlots: Record<GeneralId, string> = {
  guanyu: 'player-left-active-0',
  zhaoyun: 'player-center-active-0',
  huangzhong: 'player-right-active-0',
}

const generalWeapons: Record<GeneralId, WeaponId> = {
  guanyu: 'greenDragonBlade',
  zhaoyun: 'dragonSpear',
  huangzhong: 'sunsetBow',
}

function makeGeneral(generalId: GeneralId, star: GeneralUnit['star'] = 1, equippedWeapon?: WeaponId): GeneralUnit {
  return {
    id: `general-${generalId}`,
    kind: 'general',
    generalId,
    star,
    lane: generalId === 'zhaoyun' ? 'merge' : generalId === 'guanyu' ? 'left' : 'right',
    slotId: generalSlots[generalId],
    equippedWeapon,
    nextAttackAt: 0,
  }
}

function stateFor(seed: string, waveIndex: number, generals: GeneralUnit[] = []) {
  return {
    ...createInitialGameState(seed, 'playing', 'player'),
    waveIndex,
    generals: Object.fromEntries(generals.map((general) => [general.id, general])),
  }
}

function categoryFor(item: ReserveItem) {
  if (item.type === 'weapon') return 'weapon'
  if (item.type === 'general') return 'general'
  return 'troop'
}

function simulateCategories(initialState: GameState, slots = 100_000) {
  let state = { ...initialState, reserveItems: [], recruitsSinceGeneral: 0 }
  const counts = { troop: 0, general: 0, weapon: 0 }

  for (let index = 0; index < slots; index += 1) {
    const result = drawRecruitItem(state)
    counts[categoryFor(result.item)] += 1
    state = {
      ...state,
      recruitRngState: result.rngState,
      reserveItems: [],
      recruitsSinceGeneral: 0,
    }
  }

  return {
    troop: counts.troop / slots * 100,
    general: counts.general / slots * 100,
    weapon: counts.weapon / slots * 100,
  }
}

function expectPercent(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5)
}

describe('recruit random pool', () => {
  it('builds category weights before drawing concrete candidates', () => {
    const noWeapon = stateFor('weights-none', 4)
    expect(buildRecruitCategoryWeights(noWeapon)).toEqual([
      { key: 'troop', weight: 84 },
      { key: 'general', weight: 16 },
    ])

    const oneWeapon = stateFor('weights-one', 6, [makeGeneral('guanyu')])
    expect(getAvailableWeapons(oneWeapon)).toEqual(['greenDragonBlade'])
    expect(buildRecruitCategoryWeights(oneWeapon)).toEqual([
      { key: 'troop', weight: 78 },
      { key: 'general', weight: 14 },
      { key: 'weapon', weight: 8 },
    ])
  })

  it('matches category probabilities over 100000 recruit slots', () => {
    const scenarios = [
      { name: 'no weapon candidates', state: stateFor('sim-no-weapon', 4), expected: { troop: 84, general: 16, weapon: 0 } },
      { name: 'one weapon candidate', state: stateFor('sim-one-weapon', 6, [makeGeneral('guanyu')]), expected: { troop: 78, general: 14, weapon: 8 } },
      {
        name: 'three weapon candidates',
        state: stateFor('sim-three-weapons', 6, [makeGeneral('guanyu'), makeGeneral('zhaoyun'), makeGeneral('huangzhong')]),
        expected: { troop: 78, general: 14, weapon: 8 },
      },
      {
        name: 'one max-star general',
        state: stateFor('sim-one-max', 6, [makeGeneral('guanyu', 5), makeGeneral('zhaoyun'), makeGeneral('huangzhong')]),
        expected: { troop: 78, general: 14, weapon: 8 },
      },
      {
        name: 'two max-star generals',
        state: stateFor('sim-two-max', 6, [makeGeneral('guanyu', 5), makeGeneral('zhaoyun', 5), makeGeneral('huangzhong')]),
        expected: { troop: 78, general: 14, weapon: 8 },
      },
      {
        name: 'all max-star generals',
        state: stateFor('sim-all-max', 6, [makeGeneral('guanyu', 5), makeGeneral('zhaoyun', 5), makeGeneral('huangzhong', 5)]),
        expected: { troop: 78 / 86 * 100, general: 0, weapon: 8 / 86 * 100 },
      },
      {
        name: 'all weapons equipped',
        state: stateFor('sim-equipped', 6, [
          makeGeneral('guanyu', 1, generalWeapons.guanyu),
          makeGeneral('zhaoyun', 1, generalWeapons.zhaoyun),
          makeGeneral('huangzhong', 1, generalWeapons.huangzhong),
        ]),
        expected: { troop: 84, general: 16, weapon: 0 },
      },
      { name: 'all weapons unavailable', state: stateFor('sim-unavailable', 6), expected: { troop: 84, general: 16, weapon: 0 } },
    ]

    const report = scenarios.map((scenario) => {
      const actual = simulateCategories(scenario.state)
      expectPercent(actual.troop, scenario.expected.troop)
      expectPercent(actual.general, scenario.expected.general)
      expectPercent(actual.weapon, scenario.expected.weapon)
      return { name: scenario.name, actual, expected: scenario.expected }
    })

    console.info(`recruit probability simulation: ${JSON.stringify(report)}`)
  })

  it('forces a valid general on the 13th recruit slot and pauses pity without candidates', () => {
    const forceState = {
      ...stateFor('pity-force', 4),
      recruitsSinceGeneral: 12,
    }
    const forced = drawRecruitBatch(forceState, 6)
    expect(forced.items[0].type).toBe('general')

    const pausedState = {
      ...stateFor('pity-paused', 4, [makeGeneral('guanyu', 5), makeGeneral('zhaoyun', 5), makeGeneral('huangzhong', 5)]),
      recruitsSinceGeneral: 12,
    }
    const paused = drawRecruitItem(pausedState)
    expect(paused.item.type).not.toBe('general')
    expect(paused.recruitsSinceGeneral).toBe(12)
  })

  it('keeps player and ghost recruit batches identical for 30 batches with the same seed', () => {
    let player = createInitialGameState('same-recruit-seed', 'playing', 'player')
    let ghost = createInitialGameState('same-recruit-seed', 'playing', 'ghost')

    for (let batch = 0; batch < 30; batch += 1) {
      const playerBatch = drawRecruitBatch(player, 6)
      const ghostBatch = drawRecruitBatch(ghost, 6)
      expect(ghostBatch.items).toEqual(playerBatch.items)
      player = { ...player, recruitRngState: playerBatch.recruitRngState, recruitsSinceGeneral: playerBatch.recruitsSinceGeneral }
      ghost = { ...ghost, recruitRngState: ghostBatch.recruitRngState, recruitsSinceGeneral: ghostBatch.recruitsSinceGeneral }
    }
  })

  it('does not let combat or visual rng state alter recruit results', () => {
    const base = stateFor('split-rng', 6, [makeGeneral('guanyu'), makeGeneral('zhaoyun'), makeGeneral('huangzhong')])
    const noisy = { ...base, rngState: (base.rngState + 0x12345678) >>> 0 }

    expect(drawRecruitBatch(noisy, 6).items).toEqual(drawRecruitBatch(base, 6).items)
  })
})
