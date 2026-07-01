import { gameConfig, getRecruitCost } from '../config/gameConfig'
import type { DeploymentSlot, GameState, LaneId, RunMetrics, SideId } from '../types/game'

export type BaseDeploymentSlot = Omit<DeploymentSlot, 'id' | 'sideId' | 'occupantId'>

type SlotTemplate = BaseDeploymentSlot & { baseId: string }

const leftSlotPlan: SlotTemplate[] = [
  { baseId: 'left-active-0', zone: 'left', lane: 'left', unlocked: true, index: 0, x: 0.06, y: 0.56, facingAngleDeg: 10 },
  { baseId: 'left-active-1', zone: 'left', lane: 'left', unlocked: true, index: 1, x: 0.15, y: 0.64, facingAngleDeg: 4 },
  { baseId: 'left-active-2', zone: 'left', lane: 'left', unlocked: true, index: 2, x: 0.24, y: 0.56, facingAngleDeg: 12 },
  { baseId: 'left-active-3', zone: 'left', lane: 'left', unlocked: true, index: 3, x: 0.33, y: 0.64, facingAngleDeg: 4 },
  { baseId: 'left-active-4', zone: 'left', lane: 'left', unlocked: true, index: 4, x: 0.06, y: 0.73, facingAngleDeg: -2 },
  { baseId: 'left-locked-0', zone: 'left', lane: 'left', unlocked: false, index: 5, x: 0.1, y: 0.84, facingAngleDeg: -4 },
  { baseId: 'left-locked-1', zone: 'left', lane: 'left', unlocked: false, index: 6, x: 0.12, y: 0.96, facingAngleDeg: -8 },
]

const centerSlotPlan: SlotTemplate[] = [
  { baseId: 'center-active-0', zone: 'center', lane: 'merge', unlocked: true, index: 0, x: 0.5, y: 0.7, facingAngleDeg: -90 },
  { baseId: 'center-locked-0', zone: 'center', lane: 'merge', unlocked: false, index: 1, x: 0.5, y: 0.84, facingAngleDeg: -90 },
]

function normalizeAngle(angleDeg: number) {
  const normalized = ((angleDeg + 180) % 360 + 360) % 360 - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

function mirrorSlotHorizontally(slot: SlotTemplate): SlotTemplate {
  return {
    ...slot,
    baseId: slot.baseId.replace('left-', 'right-'),
    zone: 'right',
    lane: 'right',
    x: 1 - slot.x,
    facingAngleDeg: normalizeAngle(180 - slot.facingAngleDeg),
  }
}

export function mirrorFacingVertically(angleDeg: number) {
  return normalizeAngle(-angleDeg)
}

const slotPlan: SlotTemplate[] = [
  ...leftSlotPlan,
  ...centerSlotPlan,
  ...leftSlotPlan.map(mirrorSlotHorizontally),
]

export function createInitialSlots(sideId: SideId = 'player'): DeploymentSlot[] {
  return slotPlan.map((slot) => {
    return {
      id: `${sideId}-${slot.baseId}`,
      sideId,
      zone: slot.zone,
      lane: slot.lane,
      unlocked: slot.unlocked,
      index: slot.index,
      x: slot.x,
      y: sideId === 'player' ? slot.y : 1 - slot.y,
      facingAngleDeg: sideId === 'player' ? slot.facingAngleDeg : mirrorFacingVertically(slot.facingAngleDeg),
    }
  })
}

export function createInitialMetrics(seed: string): RunMetrics {
  return {
    seed,
    result: 'playing',
    durationSeconds: 0,
    reachedWave: 1,
    totalKills: 0,
    batchRecruitCount: 0,
    batchItemsGenerated: 0,
    batchItemsUsed: 0,
    batchItemsOverwritten: 0,
    rareItemsOverwritten: 0,
    averageSecondsBetweenRecruit: 0,
    currentRecruitCost: getRecruitCost(0),
    deployCount: 0,
    recruitCount: 0,
    mergeCount: 0,
    crossLaneMoveCount: 0,
    shovelUseCount: 0,
    unlockedSlotCount: 11,
    maxUnlockedSlots: 11,
    generalsObtained: [],
    generalStarLevels: {},
    exclusiveWeaponsEquipped: [],
    guardianHpRemaining: gameConfig.guardianMaxHp,
    reserveFullCount: 0,
    leakedByLane: { left: 0, middle: 0, right: 0 },
    restartClicked: false,
    runtimeErrorCount: 0,
  }
}

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createInitialGameState(seed = 'diaobing-001', phase: GameState['phase'] = 'idle', sideId: SideId = 'player'): GameState {
  return {
    phase,
    seed,
    rngState: hashSeed(seed),
    elapsedSeconds: 0,
    speedMultiplier: 1,
    waveIndex: 1,
    waveElapsed: 0,
    waveBreakRemaining: 0,
    nextSpawnIndex: 0,
    spawnedInWave: {},
    totalSpawned: 0,
    spawningPausedByCap: false,
    lastEnemyMovedAt: 0,
    lastEnemySpawnedAt: 0,
    lastMeaningfulProgressAt: 0,
    selectedUnitId: undefined,
    nextGeneralSkillAt: {},
    coins: gameConfig.initialCoins,
    guardianHp: gameConfig.guardianMaxHp,
    autoShovels: gameConfig.initialShovels,
    nextShovelAt: gameConfig.shovelRegenSeconds,
    reserveItems: [],
    recruitsSinceGeneral: 0,
    slots: createInitialSlots(sideId),
    troops: {},
    generals: {},
    enemies: {},
    hitEffects: [],
    attackTraces: [],
    coinFlyEffects: [],
    invalidDropTargetId: undefined,
    showCompendium: false,
    showDebug: false,
    showEnemyHp: false,
    showDps: false,
    pendingRecruitConfirmation: false,
    toastUntil: 0,
    metrics: createInitialMetrics(seed),
  }
}

export function getUnlockedCount(state: GameState): number {
  return state.slots.filter((slot) => slot.unlocked).length
}

export function hasLockedSlots(state: GameState): boolean {
  return state.slots.some((slot) => !slot.unlocked)
}

export function laneFromSlot(slot?: DeploymentSlot): LaneId | 'merge' {
  return slot?.lane ?? 'merge'
}
