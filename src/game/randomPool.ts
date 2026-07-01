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
  recruitRngState: number
  recruitsSinceGeneral: number
}

type RecruitCategory = 'troop' | 'general' | 'weapon'
type WeightedTroop = TroopType

const troopWeights = [
  { key: 'blade', weight: gameConfig.recruitWeights.blade },
  { key: 'spear', weight: gameConfig.recruitWeights.spear },
  { key: 'archer', weight: gameConfig.recruitWeights.archer },
] satisfies Array<{ key: WeightedTroop; weight: number }>

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

function weightedChoice<T extends string>(weights: Array<{ key: T; weight: number }>, rngState: number) {
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

export function getAvailableGenerals(state: GameState): GeneralId[] {
  return (Object.keys(generalConfig) as GeneralId[]).filter((generalId) => getGeneralStar(state, generalId) < gameConfig.maxGeneralStar)
}

export function getAvailableWeapons(state: GameState): WeaponId[] {
  return (Object.keys(weaponConfig) as WeaponId[]).filter((weaponId) => {
    const config = weaponConfig[weaponId]
    const general = Object.values(state.generals).find((unit) => unit.generalId === config.generalId)
    return Boolean(general && !general.equippedWeapon)
  })
}

export function buildRecruitCategoryWeights(state: GameState) {
  const generalAvailable = state.waveIndex >= 4 && getAvailableGenerals(state).length > 0
  const weaponAvailable = state.waveIndex >= 6 && getAvailableWeapons(state).length > 0
  const weights: Array<{ key: RecruitCategory; weight: number }> = []

  if (weaponAvailable) {
    weights.push({ key: 'troop', weight: 78 })
    if (generalAvailable) weights.push({ key: 'general', weight: 14 })
    weights.push({ key: 'weapon', weight: gameConfig.recruitWeights.exclusiveWeapon })
    return weights
  }

  if (generalAvailable) {
    return [
      { key: 'troop', weight: 84 },
      { key: 'general', weight: gameConfig.recruitWeights.general },
    ] satisfies Array<{ key: RecruitCategory; weight: number }>
  }

  return [{ key: 'troop', weight: 100 }] satisfies Array<{ key: RecruitCategory; weight: number }>
}

function nextPityCount(current: number, generalAvailable: boolean, drewGeneral: boolean) {
  if (!generalAvailable) return current
  return drewGeneral ? 0 : current + 1
}

function chooseTroopType(rngState: number) {
  return weightedChoice(troopWeights, rngState)
}

export function drawRecruitItem(state: GameState): RecruitResult {
  const availableGenerals = state.waveIndex >= 4 ? getAvailableGenerals(state) : []
  const availableWeapons = state.waveIndex >= 6 ? getAvailableWeapons(state) : []
  const generalAvailable = availableGenerals.length > 0
  let rngState = state.recruitRngState ?? state.rngState
  let category: RecruitCategory

  if (state.waveIndex >= 4 && state.recruitsSinceGeneral >= 12 && generalAvailable) {
    category = 'general'
  } else {
    const weights = buildRecruitCategoryWeights(state)
    if (weights.length === 1 && weights[0].key === 'troop') {
      category = 'troop'
    } else {
      const choice = weightedChoice(weights, rngState)
      category = choice.key
      rngState = choice.rngState
    }
  }

  if (category === 'general') {
    const generalChoice = chooseFrom(availableGenerals, rngState)
    const idResult = randomId('reserve-general', generalChoice.rngState)
    return {
      item: { id: idResult.id, type: 'general', generalId: generalChoice.item },
      rngState: idResult.rngState,
      recruitsSinceGeneral: 0,
    }
  }

  if (category === 'weapon') {
    const weaponChoice = chooseFrom(availableWeapons, rngState)
    const idResult = randomId('reserve-weapon', weaponChoice.rngState)
    return {
      item: { id: idResult.id, type: 'weapon', weaponId: weaponChoice.item },
      rngState: idResult.rngState,
      recruitsSinceGeneral: nextPityCount(state.recruitsSinceGeneral, generalAvailable, false),
    }
  }

  const troopChoice = chooseTroopType(rngState)
  const idResult = randomId('reserve-troop', troopChoice.rngState)
  return {
    item: { id: idResult.id, type: 'troop', troopType: troopChoice.key, star: 1 },
    rngState: idResult.rngState,
    recruitsSinceGeneral: nextPityCount(state.recruitsSinceGeneral, generalAvailable, false),
  }
}

export function drawRecruitBatch(state: GameState, count: number): RecruitBatchResult {
  let nextState: GameState = {
    ...state,
    reserveItems: [],
  }
  const items: ReserveItem[] = []
  let rngState = state.recruitRngState ?? state.rngState
  let recruitsSinceGeneral = state.recruitsSinceGeneral

  for (let index = 0; index < count; index += 1) {
    const result = drawRecruitItem({
      ...nextState,
      recruitRngState: rngState,
      recruitsSinceGeneral,
      reserveItems: items,
    })
    items.push(result.item)
    rngState = result.rngState
    recruitsSinceGeneral = result.recruitsSinceGeneral
    nextState = {
      ...nextState,
      recruitRngState: rngState,
      recruitsSinceGeneral,
      reserveItems: items,
    }
  }

  return { items, rngState, recruitRngState: rngState, recruitsSinceGeneral }
}
