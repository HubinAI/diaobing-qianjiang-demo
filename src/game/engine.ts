import { gameConfig, getRecruitCost } from '../config/gameConfig'
import { distancePointToPath, enemyPaths, playerRoadLayouts, requiredRoadClearanceForPoint, roadClearanceConfig, type NormalizedPoint } from './paths'
import { getWaveTable, pickRandomWaveTable, type WaveTableId } from './waves'
import type { DeploymentSlot, EnemyPathId, GameState, LaneId, RunMetrics, SideId } from '../types/game'

export type BaseDeploymentSlot = Omit<DeploymentSlot, 'id' | 'sideId' | 'occupantId' | 'adjacentRoadId'>

type RoadKey = 'left' | 'right' | 'merge'
type SlotTemplate = BaseDeploymentSlot & { baseId: string; adjacentRoadKey: RoadKey }
type SlotAnchor = Omit<SlotTemplate, 'x' | 'y' | 'facingAngleDeg'> & {
  roadPoint: NormalizedPoint
  offset: NormalizedPoint
  targetPoint?: NormalizedPoint
}

function normalizeAngle(angleDeg: number) {
  const normalized = ((angleDeg + 180) % 360 + 360) % 360 - 180
  return Object.is(normalized, -0) ? 0 : normalized
}

function angleToPoint(from: NormalizedPoint, target: NormalizedPoint) {
  const dy = (target.y - from.y) * gameConfig.battlefieldHeightToWidthRatio
  const dx = target.x - from.x
  return normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI)
}

function slotFromRoad(anchor: SlotAnchor): SlotTemplate {
  const point = {
    x: anchor.roadPoint.x + anchor.offset.x,
    y: anchor.roadPoint.y + anchor.offset.y,
  }
  return {
    baseId: anchor.baseId,
    zone: anchor.zone,
    lane: anchor.lane,
    adjacentRoadKey: anchor.adjacentRoadKey,
    unlocked: anchor.unlocked,
    index: anchor.index,
    x: point.x,
    y: point.y,
    facingAngleDeg: angleToPoint(point, anchor.targetPoint ?? anchor.roadPoint),
  }
}

const leftRoad = playerRoadLayouts.left

// 槽位布局策略：沿 L 形路线外侧形成规整的两列
// - 横向段（上边）：槽位在路线上方，y 对齐
// - 纵向段（左边）：槽位在路线左侧，x 对齐
// - 第一列（主槽位 unlocked）：靠近路线
// - 第二列（锁定槽位 locked）：在第一列外侧

const leftSlotAnchors: SlotAnchor[] = [
  // --- 横向段：2个主槽位（路线上方）---
  {
    baseId: 'left-active-0',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: true, index: 0,
    roadPoint: { x: 0.12, y: leftRoad.horizontal.start.y },
    offset: { x: 0, y: 0.12 },
  },
  {
    baseId: 'left-active-1',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: true, index: 1,
    roadPoint: { x: 0.23, y: leftRoad.horizontal.start.y },
    offset: { x: 0, y: 0.12 },
    targetPoint: leftRoad.turn[0],
  },
  // --- 纵向段：3个主槽位 + 3个锁定（路线左侧）---
  {
    baseId: 'left-active-2',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: true, index: 2,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.72 },
    offset: { x: -0.12, y: 0 },
  },
  {
    baseId: 'left-active-3',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: true, index: 3,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.81 },
    offset: { x: -0.12, y: 0 },
  },
  {
    baseId: 'left-active-4',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: true, index: 4,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.90 },
    offset: { x: -0.12, y: 0 },
  },
  {
    baseId: 'left-locked-0',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: false, index: 5,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.72 },
    offset: { x: -0.20, y: 0 },
  },
  {
    baseId: 'left-locked-1',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: false, index: 6,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.81 },
    offset: { x: -0.20, y: 0 },
  },
  {
    baseId: 'left-locked-2',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: false, index: 7,
    roadPoint: { x: leftRoad.vertical.start.x, y: 0.90 },
    offset: { x: -0.20, y: 0 },
  },
  // --- 拐角锁定格（位于转弯外侧，与上方 active-1 保持间距）---
  {
    baseId: 'left-locked-turn',
    zone: 'left', lane: 'left', adjacentRoadKey: 'left',
    unlocked: false, index: 8,
    roadPoint: { x: 0.27, y: 0.53 },
    offset: { x: -0.08, y: 0.10 },
    targetPoint: { x: 0.19, y: 0.58 },
  },
]

const leftSlotPlan: SlotTemplate[] = leftSlotAnchors.map(slotFromRoad)

const centerSlotPlan: SlotTemplate[] = [
  { baseId: 'center-active-0', zone: 'center', lane: 'merge', adjacentRoadKey: 'merge', unlocked: true, index: 0, x: 0.5, y: 0.72, facingAngleDeg: -90 },
  { baseId: 'center-locked-0', zone: 'center', lane: 'merge', adjacentRoadKey: 'merge', unlocked: false, index: 1, x: 0.5, y: 0.81, facingAngleDeg: -90 },
]

function mirrorSlotHorizontally(slot: SlotTemplate): SlotTemplate {
  return {
    ...slot,
    baseId: slot.baseId.replace('left-', 'right-'),
    zone: 'right',
    lane: 'right',
    adjacentRoadKey: slot.adjacentRoadKey === 'left' ? 'right' : slot.adjacentRoadKey,
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

function slotClearancePathIds(sideId: SideId, slot: SlotTemplate): EnemyPathId[] {
  if (slot.adjacentRoadKey === 'merge') return [`${sideId}-left`, `${sideId}-right`]
  return [`${sideId}-${slot.adjacentRoadKey}`]
}

function assertSlotClearance(slot: DeploymentSlot, template: SlotTemplate) {
  const pathIds = slotClearancePathIds(slot.sideId, template)
  const distances = pathIds.map((pathId) => ({
    pathId,
    distance: distancePointToPath(slot, enemyPaths[pathId].points),
    required: template.adjacentRoadKey === 'merge' ? roadClearanceConfig.minimumRatio : requiredRoadClearanceForPoint(slot, pathId),
  }))
  const nearest = distances.reduce((best, current) => (current.distance < best.distance ? current : best))
  if (nearest.distance + 0.000001 < nearest.required) {
    throw new Error(`Deployment slot ${slot.id} is inside road safety corridor for ${nearest.pathId}: ${nearest.distance.toFixed(4)} < ${nearest.required.toFixed(4)}`)
  }
}

export function createInitialSlots(sideId: SideId = 'player'): DeploymentSlot[] {
  return slotPlan.map((slot) => {
    const deploymentSlot = {
      id: `${sideId}-${slot.baseId}`,
      sideId,
      zone: slot.zone,
      lane: slot.lane,
      adjacentRoadId: `${sideId}-${slot.adjacentRoadKey}`,
      unlocked: slot.unlocked,
      index: slot.index,
      x: slot.x,
      y: sideId === 'player' ? slot.y : 1 - slot.y,
      facingAngleDeg: sideId === 'player' ? slot.facingAngleDeg : mirrorFacingVertically(slot.facingAngleDeg),
    }
    assertSlotClearance(deploymentSlot, slot)
    return deploymentSlot
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
    unlockedSlotCount: 13,
    maxUnlockedSlots: 13,
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
  const initialRngState = hashSeed(seed)
  const { table: waveTable } = pickRandomWaveTable(initialRngState)
  return {
    phase,
    seed,
    rngState: initialRngState,
    recruitRngState: initialRngState,
    elapsedSeconds: 0,
    speedMultiplier: 1,
    waveTable,
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
