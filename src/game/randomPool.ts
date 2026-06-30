import { gameConfig, generalConfig, weaponConfig } from '../config/gameConfig'
import type { GameState, GeneralId, ReserveItem, TroopType, WeaponId } from '../types/game'

interface RandomStep {
  value: number
  nextState: number
}

interface RecruitResult {
  item: ReserveItem
  rngState: number
  recruitsSinceGeneral: number
}

interface RecruitBatchResult {
  items: ReserveItem[]
  rngState: number
  recruitsSinceGeneral: number
}

type WeightedKey = TroopType | 'general' | 'exclusiveWeapon'

export function nextRandom(rngState: number): RandomStep {
  const state = rngState + 0x6d2b79f5
  let mixed = state
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  return {
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296,
    nextState: state >>> 0,
  }
}

function randomId(prefix: string, rngState: number): { id: string; rngState: number } {
  const step = nextRandom(rngState)
  return {
    id: `${prefix}-${Math.floor(step.value * 1_000_000_000).toString(36)}`,
    rngState: step.nextState,
  }
}

function chooseFrom<T>(items: T[], rngState: number): { item: T; rngState: number } {
  const step = nextRandom(rngState)
  const index = Math.min(items.length - 1, Math.floor(step.value * items.length))
  return { item: items[index], rngState: step.nextState }
}

function weightedChoice(weights: Array<{ key: WeightedKey; weight: number }>, rngState: number) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0)
  const step = nextRandom(rngState)
  let cursor = step.value * total
  for (const item of weights) {
    cursor -= item.weight
    if (cursor <= 0) {
      return { key: item.key, rngState: step.nextState }
    }
  }
  return { key: weights[weights.length - 1].key, rngState: step.nextState }
}

function getGeneralStar(state: GameState, generalId: GeneralId): number {
  return Object.values(state.generals).find((general) => general.generalId === generalId)?.star ?? 0
}

function getAvailableGenerals(state: GameState): GeneralId[] {
  return (Object.keys(generalConfig) as GeneralId[]).filter((generalId) => getGeneralStar(state, generalId) < gameConfig.maxGeneralStar)
}

function getAvailableWeapons(state: GameState): WeaponId[] {
  const reserveWeaponIds = new Set(
    state.reserveItems.filter((item): item is Extract<ReserveItem, { type: 'weapon' }> => item.type === 'weapon').map((item) => item.weaponId),
  )
  return (Object.keys(weaponConfig) as WeaponId[]).filter((weaponId) => {
    const config = weaponConfig[weaponId]
    const general = Object.values(state.generals).find((unit) => unit.generalId === config.generalId)
    return Boolean(general && !general.equippedWeapon && !reserveWeaponIds.has(weaponId))
  })
}

function buildWeights(state: GameState) {
  const generalAvailable = state.waveIndex >= 4 && getAvailableGenerals(state).length > 0
  const weaponAvailable = state.waveIndex >= 6 && getAvailableWeapons(state).length > 0

  if (weaponAvailable) {
    return [
      { key: 'blade', weight: 26 },
      { key: 'spear', weight: 26 },
      { key: 'archer', weight: 26 },
      { key: 'general', weight: 14 },
      { key: 'exclusiveWeapon', weight: 8 },
    ] satisfies Array<{ key: WeightedKey; weight: number }>
  }

  if (generalAvailable) {
    return [
      { key: 'blade', weight: 28 },
      { key: 'spear', weight: 28 },
      { key: 'archer', weight: 28 },
      { key: 'general', weight: gameConfig.recruitWeights.general },
    ] satisfies Array<{ key: WeightedKey; weight: number }>
  }

  return [
    { key: 'blade', weight: gameConfig.recruitWeights.blade },
    { key: 'spear', weight: gameConfig.recruitWeights.spear },
    { key: 'archer', weight: gameConfig.recruitWeights.archer },
  ] satisfies Array<{ key: WeightedKey; weight: number }>
}

export function drawRecruitItem(state: GameState): RecruitResult {
  const availableGenerals = getAvailableGenerals(state)
  let rngState = state.rngState
  let key: WeightedKey

  if (state.waveIndex >= 4 && state.recruitsSinceGeneral >= 12 && availableGenerals.length > 0) {
    key = 'general'
  } else {
    const choice = weightedChoice(buildWeights(state), rngState)
    key = choice.key
    rngState = choice.rngState
  }

  if (key === 'general') {
    const generalChoice = chooseFrom(availableGenerals, rngState)
    const idResult = randomId('reserve-general', generalChoice.rngState)
    return {
      item: { id: idResult.id, type: 'general', generalId: generalChoice.item },
      rngState: idResult.rngState,
      recruitsSinceGeneral: 0,
    }
  }

  if (key === 'exclusiveWeapon') {
    const weaponChoice = chooseFrom(getAvailableWeapons(state), rngState)
    const idResult = randomId('reserve-weapon', weaponChoice.rngState)
    return {
      item: { id: idResult.id, type: 'weapon', weaponId: weaponChoice.item },
      rngState: idResult.rngState,
      recruitsSinceGeneral: state.recruitsSinceGeneral + 1,
    }
  }

  const idResult = randomId('reserve-troop', rngState)
  return {
    item: { id: idResult.id, type: 'troop', troopType: key, star: 1 },
    rngState: idResult.rngState,
    recruitsSinceGeneral: state.recruitsSinceGeneral + 1,
  }
}

export function drawRecruitBatch(state: GameState, count: number): RecruitBatchResult {
  let nextState: GameState = {
    ...state,
    reserveItems: [],
  }
  const items: ReserveItem[] = []
  let rngState = state.rngState
  const shouldForceGeneral = state.waveIndex >= 4 && state.recruitsSinceGeneral >= 12

  for (let index = 0; index < count; index += 1) {
    const result = drawRecruitItem({
      ...nextState,
      rngState,
      recruitsSinceGeneral: shouldForceGeneral && index === 0 ? 12 : 0,
      reserveItems: items,
    })
    items.push(result.item)
    rngState = result.rngState
    nextState = {
      ...nextState,
      rngState,
      recruitsSinceGeneral: 0,
      reserveItems: items,
    }
  }

  const hasGeneral = items.some((item) => item.type === 'general')
  const recruitsSinceGeneral = hasGeneral ? 0 : state.recruitsSinceGeneral + 1

  return { items, rngState, recruitsSinceGeneral }
}
