import { gameConfig, getRecruitCost } from '../config/gameConfig'
import type { DeploymentSlot, GameState, LaneId, RunMetrics, SideId } from '../types/game'

export type BaseDeploymentSlot = Omit<DeploymentSlot, 'id' | 'sideId' | 'occupantId'>

const slotPlan: Array<BaseDeploymentSlot & { baseId: string }> = [
  { baseId: 'left-active-0', zone: 'left', lane: 'left', unlocked: true, index: 0, x: 0.105, y: 0.34, facingAngleDeg: 8 },
  { baseId: 'left-active-1', zone: 'left', lane: 'left', unlocked: true, index: 1, x: 0.155, y: 0.5, facingAngleDeg: 2 },
  { baseId: 'left-active-2', zone: 'left', lane: 'left', unlocked: true, index: 2, x: 0.225, y: 0.66, facingAngleDeg: 4 },
  { baseId: 'left-active-3', zone: 'left', lane: 'left', unlocked: true, index: 3, x: 0.305, y: 0.8, facingAngleDeg: 14 },
  { baseId: 'left-locked-0', zone: 'left', lane: 'left', unlocked: false, index: 4, x: 0.075, y: 0.49, facingAngleDeg: 0 },
  { baseId: 'left-locked-1', zone: 'left', lane: 'left', unlocked: false, index: 5, x: 0.16, y: 0.75, facingAngleDeg: 6 },
  { baseId: 'center-active-0', zone: 'center', lane: 'merge', unlocked: true, index: 0, x: 0.5, y: 0.8, facingAngleDeg: -90 },
  { baseId: 'center-locked-0', zone: 'center', lane: 'merge', unlocked: false, index: 1, x: 0.5, y: 0.63, facingAngleDeg: -90 },
  { baseId: 'right-active-0', zone: 'right', lane: 'right', unlocked: true, index: 0, x: 0.895, y: 0.34, facingAngleDeg: 172 },
  { baseId: 'right-active-1', zone: 'right', lane: 'right', unlocked: true, index: 1, x: 0.845, y: 0.5, facingAngleDeg: 178 },
  { baseId: 'right-active-2', zone: 'right', lane: 'right', unlocked: true, index: 2, x: 0.775, y: 0.66, facingAngleDeg: 184 },
  { baseId: 'right-active-3', zone: 'right', lane: 'right', unlocked: true, index: 3, x: 0.695, y: 0.8, facingAngleDeg: 194 },
  { baseId: 'right-locked-0', zone: 'right', lane: 'right', unlocked: false, index: 4, x: 0.925, y: 0.49, facingAngleDeg: 180 },
  { baseId: 'right-locked-1', zone: 'right', lane: 'right', unlocked: false, index: 5, x: 0.84, y: 0.75, facingAngleDeg: 174 },
]

function playerY(y: number) {
  return 0.5 + y * 0.5
}

function normalizeAngle(angleDeg: number) {
  const normalized = ((angleDeg + 180) % 360 + 360) % 360 - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

export function mirrorFacingVertically(angleDeg: number) {
  return normalizeAngle(-angleDeg)
}

export function createInitialSlots(sideId: SideId = 'player'): DeploymentSlot[] {
  return slotPlan.map((slot) => {
    const y = playerY(slot.y)
    return {
      id: `${sideId}-${slot.baseId}`,
      sideId,
      zone: slot.zone,
      lane: slot.lane,
      unlocked: slot.unlocked,
      index: slot.index,
      x: slot.x,
      y: sideId === 'player' ? y : 1 - y,
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
    unlockedSlotCount: 9,
    maxUnlockedSlots: 9,
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
