import { duelConfig, enemyConfig, gameConfig, generalConfig, getRecruitCost, troopConfig, weaponConfig } from '../config/gameConfig'
import { tickCombat } from '../game/combat'
import { createInitialGameState, laneFromSlot } from '../game/engine'
import { canMergeTroops, nextStar } from '../game/merge'
import { pathIdFor } from '../game/paths'
import { drawRecruitBatch } from '../game/randomPool'
import { tickShovels, unlockSlotWithShovel } from '../game/shovel'
import type {
  BoardUnit,
  DeploymentSlot,
  DuelGameState,
  DragPayload,
  DropTarget,
  EnemyType,
  EnemyUnit,
  GameState,
  GeneralId,
  LaneId,
  ReserveItem,
  SideId,
  SlotLane,
  Star,
  TroopType,
  TroopUnit,
  WeaponId,
} from '../types/game'

export type SideAction =
  | { type: 'noop' }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart'; seed?: string }
  | { type: 'advanceTime'; seconds: number }
  | { type: 'tick'; delta: number }
  | { type: 'recruit'; confirmed?: boolean }
  | { type: 'confirmRecruitOverwrite' }
  | { type: 'cancelRecruitOverwrite' }
  | { type: 'drop'; payload: DragPayload; target: DropTarget }
  | { type: 'selectSlot'; slotId: string }
  | { type: 'clearSelection' }
  | { type: 'selectAutoShovel' }
  | { type: 'selectReserveShovel'; itemId: string }
  | { type: 'unlockSelectedSlot'; slotId: string }
  | { type: 'setCoins'; coins: number }
  | { type: 'setGuardianHp'; hp: number }
  | { type: 'setEnemyHp'; enemyId: string; hp: number }
  | { type: 'setSpeed'; speed: number }
  | { type: 'jumpWave'; waveIndex: number }
  | { type: 'spawnEnemy'; lane: LaneId; enemyType: EnemyType; progress?: number }
  | { type: 'spawnWave'; waveIndex: number }
  | { type: 'debugAddTroop'; troopType: TroopType; star?: Star }
  | { type: 'debugAddGeneral'; generalId: GeneralId }
  | { type: 'debugAddWeapon'; weaponId: WeaponId }
  | { type: 'debugAddShovel' }
  | { type: 'debugAddAutoShovel' }
  | { type: 'setReserveItems'; items: ReserveItem[] }
  | { type: 'unlockAllSlots' }
  | { type: 'clearReserve' }
  | { type: 'recordRuntimeError' }
  | { type: 'toggleEnemyHp' }
  | { type: 'toggleDps' }
  | { type: 'toggleCompendium' }
  | { type: 'toggleDebug' }

function withToast(state: GameState, toast: string, invalidDropTargetId?: string): GameState {
  return { ...state, toast, toastUntil: state.elapsedSeconds + 1.8, invalidDropTargetId }
}

function clearExpiredToast(state: GameState): GameState {
  if (state.toast && state.elapsedSeconds >= state.toastUntil) {
    return { ...state, toast: undefined, invalidDropTargetId: undefined }
  }
  return state
}

function removeReserveItem(items: ReserveItem[], itemId: string) {
  return items.filter((item) => item.id !== itemId)
}

function getUnit(state: GameState, unitId: string): BoardUnit | undefined {
  return state.troops[unitId] ?? state.generals[unitId]
}

function getSlotByOccupant(state: GameState, unitId: string) {
  return state.slots.find((slot) => slot.occupantId === unitId)
}

function updateUnitLane<T extends BoardUnit>(unit: T, lane: SlotLane, slotId: string): T {
  return { ...unit, lane, slotId }
}

function setSlotOccupant(state: GameState, slotId: string, occupantId?: string) {
  return state.slots.map((slot) => (slot.id === slotId ? { ...slot, occupantId } : slot))
}

function makeReserveFromTroop(unit: TroopUnit): ReserveItem {
  return { id: `reserve-${unit.id}`, type: 'troop', troopType: unit.troopType, star: unit.star }
}

function makeTroopFromReserve(item: Extract<ReserveItem, { type: 'troop' }>, slot: DeploymentSlot, elapsedSeconds: number): TroopUnit {
  const unitId = `unit-${item.id}`
  return {
    id: unitId,
    kind: 'troop',
    troopType: item.troopType,
    star: item.star,
    lane: laneFromSlot(slot),
    slotId: slot.id,
    nextAttackAt: elapsedSeconds,
  }
}

function replaceReserveItem(items: ReserveItem[], itemId: string, replacement: ReserveItem) {
  return items.map((item) => (item.id === itemId ? replacement : item))
}

function insertReserve(items: ReserveItem[], item: ReserveItem, index: number) {
  const next = [...items]
  next.splice(Math.min(index, next.length), 0, item)
  return next
}

function getGeneralStarLevels(state: GameState) {
  return Object.fromEntries(Object.values(state.generals).map((general) => [general.generalId, general.star]))
}

function markEffect(state: GameState, text: string): GameState {
  return { ...state, lastEffect: { id: `${state.elapsedSeconds}-${text}`, text, at: state.elapsedSeconds } }
}

function isRareReserveItem(item: ReserveItem) {
  return item.type === 'general' || item.type === 'weapon'
}

function debugItemId(state: GameState, label: string) {
  return `debug-${label}-${Math.floor(state.elapsedSeconds * 1000)}-${state.reserveItems.length}`
}

function reserveItemLabel(item: ReserveItem) {
  if (item.type === 'troop') return troopConfig[item.troopType].label
  if (item.type === 'general') return generalConfig[item.generalId].label
  if (item.type === 'weapon') return weaponConfig[item.weaponId].label
  return '铁锹'
}

function troopMergeError(a: { troopType: TroopType; star: Star }, b: { troopType: TroopType; star: Star }) {
  if (a.troopType !== b.troopType) return '只能合成相同兵种'
  if (a.star !== b.star) return '需要相同星级才能合成'
  return '已达5星，无法继续合成'
}

function troopMergeText(troopType: TroopType, star: Star) {
  return `${troopConfig[troopType].label}兵升至${star}星`
}

function generalMergeText(generalId: GeneralId, star: Star) {
  return `${generalConfig[generalId].label}升至${star}星`
}

function addReserveItem(state: GameState, item: ReserveItem): GameState {
  if (state.reserveItems.length >= gameConfig.reserveCapacity) return withToast(state, '预备格已满')
  return {
    ...state,
    reserveItems: [...state.reserveItems, item],
    toast: `已加入预备格：${reserveItemLabel(item)}`,
    toastUntil: state.elapsedSeconds + 1.2,
  }
}

function recruit(state: GameState, confirmed = false): GameState {
  const recruitCost = getRecruitCost(state.metrics.batchRecruitCount)
  if (state.coins < recruitCost) {
    return withToast(state, '银币不足')
  }

  if (!confirmed && state.reserveItems.some(isRareReserveItem)) {
    return {
      ...state,
      pendingRecruitConfirmation: true,
      toast: '仍有稀有内容未使用，确认刷新并替换？',
      toastUntil: state.elapsedSeconds + 2.4,
    }
  }

  const recycledCount = state.reserveItems.length
  const rareRecycledCount = state.reserveItems.filter(isRareReserveItem).length
  const result = drawRecruitBatch(state, gameConfig.recruitBatchSize)
  const batchRecruitCount = state.metrics.batchRecruitCount + 1
  const batchIndex = state.metrics.batchRecruitCount
  const reserveItems = result.items.map((item, recruitSlotIndex) => ({
    ...item,
    batchIndex,
    recruitSlotIndex,
  }))
  const interval =
    state.metrics.lastRecruitAt === undefined ? undefined : Math.max(0, state.elapsedSeconds - state.metrics.lastRecruitAt)
  const averageSecondsBetweenRecruit =
    interval === undefined
      ? state.metrics.averageSecondsBetweenRecruit
      : state.metrics.averageSecondsBetweenRecruit === 0
        ? interval
        : (state.metrics.averageSecondsBetweenRecruit * (batchRecruitCount - 2) + interval) / (batchRecruitCount - 1)

  return markEffect({
    ...state,
    coins: state.coins - recruitCost,
    rngState: result.rngState,
    recruitsSinceGeneral: result.recruitsSinceGeneral,
    reserveItems,
    pendingRecruitConfirmation: false,
    selectedShovel: undefined,
    toast: recycledCount > 0 ? `本轮补兵：替换${recycledCount}个未使用内容` : '本轮补兵：刷新6格',
    toastUntil: state.elapsedSeconds + 1.2,
    metrics: {
      ...state.metrics,
      batchRecruitCount,
      batchItemsGenerated: state.metrics.batchItemsGenerated + reserveItems.length,
      batchItemsOverwritten: state.metrics.batchItemsOverwritten + recycledCount,
      rareItemsOverwritten: state.metrics.rareItemsOverwritten + rareRecycledCount,
      averageSecondsBetweenRecruit,
      currentRecruitCost: getRecruitCost(batchRecruitCount),
      lastRecruitAt: state.elapsedSeconds,
      recruitCount: batchRecruitCount,
    },
  }, '补兵')
}

function mergeReserveTroop(state: GameState, sourceItem: Extract<ReserveItem, { type: 'troop' }>, targetItem: Extract<ReserveItem, { type: 'troop' }>) {
  if (!canMergeTroops(sourceItem, targetItem)) {
    return withToast(state, troopMergeError(sourceItem, targetItem))
  }
  const mergedStar = nextStar(targetItem.star)
  const reserveItems = state.reserveItems
    .filter((item) => item.id !== sourceItem.id)
    .map((item) => (item.id === targetItem.id ? { ...targetItem, star: mergedStar } : item))

  return markEffect({
    ...state,
    reserveItems,
    metrics: {
      ...state.metrics,
      mergeCount: state.metrics.mergeCount + 1,
      batchItemsUsed: state.metrics.batchItemsUsed + 1,
    },
  }, troopMergeText(targetItem.troopType, mergedStar))
}

function upgradeGeneral(state: GameState, item: Extract<ReserveItem, { type: 'general' }>, targetUnit: BoardUnit) {
  if (targetUnit.kind !== 'general' || targetUnit.generalId !== item.generalId) {
    return withToast(state, '只能与同名名将合成', getSlotByOccupant(state, targetUnit.id)?.id)
  }
  if (targetUnit.star >= gameConfig.maxGeneralStar) {
    return withToast(state, '已达5星，无法继续合成', getSlotByOccupant(state, targetUnit.id)?.id)
  }
  const mergedStar = nextStar(targetUnit.star)

  const generals = {
    ...state.generals,
    [targetUnit.id]: { ...targetUnit, star: mergedStar },
  }
  const nextState = {
    ...state,
    generals,
    reserveItems: removeReserveItem(state.reserveItems, item.id),
    metrics: {
      ...state.metrics,
      batchItemsUsed: state.metrics.batchItemsUsed + 1,
      mergeCount: state.metrics.mergeCount + 1,
      generalStarLevels: getGeneralStarLevels({ ...state, generals }),
    },
  }
  return markEffect(nextState, generalMergeText(item.generalId, mergedStar))
}

function equipWeapon(state: GameState, item: Extract<ReserveItem, { type: 'weapon' }>, targetUnit: BoardUnit) {
  const weapon = weaponConfig[item.weaponId]
  if (targetUnit.kind !== 'general' || targetUnit.generalId !== weapon.generalId) {
    return withToast(state, '该武器不属于此名将', getSlotByOccupant(state, targetUnit.id)?.id)
  }
  if (targetUnit.equippedWeapon) {
    return withToast(state, '该名将已装备专属武器', getSlotByOccupant(state, targetUnit.id)?.id)
  }
  const generals = {
    ...state.generals,
    [targetUnit.id]: { ...targetUnit, equippedWeapon: item.weaponId },
  }
  return markEffect({
    ...state,
    generals,
    reserveItems: removeReserveItem(state.reserveItems, item.id),
    metrics: {
      ...state.metrics,
      batchItemsUsed: state.metrics.batchItemsUsed + 1,
      exclusiveWeaponsEquipped: [...new Set([...state.metrics.exclusiveWeaponsEquipped, weapon.label])],
    },
  }, '武器质变')
}

function deployReserveToSlot(state: GameState, item: ReserveItem, slotId: string): GameState {
  const slot = state.slots.find((candidate) => candidate.id === slotId)
  if (!slot) return state
  if (!slot.unlocked) {
    if (item.type === 'shovel') {
      return unlockSlotWithShovel(state, slotId, { source: 'reserve', itemId: item.id })
    }
    return withToast(state, '目标格未解锁', slotId)
  }

  if (slot.occupantId) {
    const targetUnit = getUnit(state, slot.occupantId)
    if (!targetUnit) return state

    if (item.type === 'troop' && targetUnit.kind === 'troop') {
      if (canMergeTroops(item, targetUnit)) {
        const mergedStar = nextStar(targetUnit.star)
        const troops = {
          ...state.troops,
          [targetUnit.id]: { ...targetUnit, star: mergedStar },
        }
        return markEffect({
          ...state,
          troops,
          reserveItems: removeReserveItem(state.reserveItems, item.id),
          metrics: {
            ...state.metrics,
            mergeCount: state.metrics.mergeCount + 1,
            batchItemsUsed: state.metrics.batchItemsUsed + 1,
          },
        }, troopMergeText(targetUnit.troopType, mergedStar))
      }

      const nextUnit = makeTroopFromReserve(item, slot, state.elapsedSeconds)
      const troops = { ...state.troops }
      delete troops[targetUnit.id]
      troops[nextUnit.id] = nextUnit
      return {
        ...state,
        troops,
        slots: setSlotOccupant(state, slot.id, nextUnit.id),
        reserveItems: replaceReserveItem(state.reserveItems, item.id, makeReserveFromTroop(targetUnit)),
        metrics: {
          ...state.metrics,
          batchItemsUsed: state.metrics.batchItemsUsed + 1,
          deployCount: state.metrics.deployCount + 1,
        },
      }
    }

    if (item.type === 'general') {
      return upgradeGeneral(state, item, targetUnit)
    }

    if (item.type === 'weapon') {
      return equipWeapon(state, item, targetUnit)
    }

    return withToast(state, '目标格已被占用', slotId)
  }

  if (item.type === 'troop') {
    const unitId = `unit-${item.id}`
    return {
      ...state,
      reserveItems: removeReserveItem(state.reserveItems, item.id),
      slots: setSlotOccupant(state, slot.id, unitId),
      troops: {
        ...state.troops,
        [unitId]: {
          id: unitId,
          kind: 'troop',
          troopType: item.troopType,
          star: item.star,
          lane: laneFromSlot(slot),
          slotId: slot.id,
          nextAttackAt: state.elapsedSeconds,
        },
      },
      metrics: {
        ...state.metrics,
        batchItemsUsed: state.metrics.batchItemsUsed + 1,
        deployCount: state.metrics.deployCount + 1,
      },
    }
  }

  if (item.type === 'general') {
    const existing = Object.values(state.generals).find((general) => general.generalId === item.generalId)
    if (existing) return withToast(state, '重复名将请拖到已有名将上升星')
    const unitId = `general-${item.generalId}`
    const generals = {
      ...state.generals,
      [unitId]: {
        id: unitId,
        kind: 'general' as const,
        generalId: item.generalId,
        star: 1 as Star,
        lane: laneFromSlot(slot),
        slotId: slot.id,
        nextAttackAt: state.elapsedSeconds,
      },
    }
    const nextGeneralSkillAt = {
      ...state.nextGeneralSkillAt,
      ...(item.generalId === 'huangzhong' ? { huangzhong: state.elapsedSeconds + gameConfig.generalSkills.huangzhongVolleySeconds } : {}),
      ...(item.generalId === 'zhaoyun' ? { zhaoyun: state.elapsedSeconds + gameConfig.generalSkills.zhaoyunThrustSeconds } : {}),
    }
    return markEffect({
      ...state,
      reserveItems: removeReserveItem(state.reserveItems, item.id),
      slots: setSlotOccupant(state, slot.id, unitId),
      generals,
      nextGeneralSkillAt,
      metrics: {
        ...state.metrics,
        batchItemsUsed: state.metrics.batchItemsUsed + 1,
        deployCount: state.metrics.deployCount + 1,
        generalsObtained: [...new Set([...state.metrics.generalsObtained, generalConfig[item.generalId].label])],
        generalStarLevels: getGeneralStarLevels({ ...state, generals }),
      },
    }, '名将登场')
  }

  if (item.type === 'weapon') return withToast(state, '专属武器需要拖到对应名将上', slotId)
  return withToast(state, '铁锹需要拖到锁定格', slotId)
}

function moveSlotUnitToSlot(state: GameState, unitId: string, targetSlotId: string): GameState {
  const sourceSlot = getSlotByOccupant(state, unitId)
  const targetSlot = state.slots.find((slot) => slot.id === targetSlotId)
  const sourceUnit = getUnit(state, unitId)
  if (!sourceSlot || !targetSlot || !sourceUnit) return state
  if (!targetSlot.unlocked) return withToast(state, '目标格未解锁', targetSlotId)
  if (sourceSlot.id === targetSlot.id) return state

  const previousLane = sourceUnit.lane
  const nextLane = laneFromSlot(targetSlot)

  if (targetSlot.occupantId) {
    const targetUnit = getUnit(state, targetSlot.occupantId)
    if (!targetUnit) return state

    if (sourceUnit.kind === 'troop' && targetUnit.kind === 'troop') {
      if (canMergeTroops(sourceUnit, targetUnit)) {
        const mergedStar = nextStar(targetUnit.star)
        const troops = { ...state.troops }
        troops[targetUnit.id] = { ...targetUnit, star: mergedStar }
        delete troops[sourceUnit.id]
        return markEffect({
          ...state,
          troops,
          slots: state.slots.map((slot) =>
            slot.id === sourceSlot.id ? { ...slot, occupantId: undefined } : slot,
          ),
          metrics: { ...state.metrics, mergeCount: state.metrics.mergeCount + 1 },
        }, troopMergeText(targetUnit.troopType, mergedStar))
      }
    }

    const slots = state.slots.map((slot) => {
      if (slot.id === sourceSlot.id) return { ...slot, occupantId: targetUnit.id }
      if (slot.id === targetSlot.id) return { ...slot, occupantId: sourceUnit.id }
      return slot
    })
    const troops = { ...state.troops }
    const generals = { ...state.generals }
    if (sourceUnit.kind === 'troop') troops[sourceUnit.id] = updateUnitLane(sourceUnit, nextLane, targetSlot.id)
    else generals[sourceUnit.id] = updateUnitLane(sourceUnit, nextLane, targetSlot.id)
    if (targetUnit.kind === 'troop') troops[targetUnit.id] = updateUnitLane(targetUnit, previousLane, sourceSlot.id)
    else generals[targetUnit.id] = updateUnitLane(targetUnit, previousLane, sourceSlot.id)

    return {
      ...state,
      slots,
      troops,
      generals,
      metrics: {
        ...state.metrics,
        crossLaneMoveCount: state.metrics.crossLaneMoveCount + (previousLane !== nextLane ? 1 : 0),
      },
    }
  }

  const slots = state.slots.map((slot) => {
    if (slot.id === sourceSlot.id) return { ...slot, occupantId: undefined }
    if (slot.id === targetSlot.id) return { ...slot, occupantId: sourceUnit.id }
    return slot
  })
  const troops = { ...state.troops }
  const generals = { ...state.generals }
  if (sourceUnit.kind === 'troop') troops[sourceUnit.id] = updateUnitLane(sourceUnit, nextLane, targetSlot.id)
  else generals[sourceUnit.id] = updateUnitLane(sourceUnit, nextLane, targetSlot.id)

  return {
    ...state,
    slots,
    troops,
    generals,
    metrics: {
      ...state.metrics,
      crossLaneMoveCount: state.metrics.crossLaneMoveCount + (previousLane !== nextLane ? 1 : 0),
    },
  }
}

function dropToReserve(state: GameState, payload: DragPayload, index: number): GameState {
  const targetItem = state.reserveItems[index]

  if (payload.source === 'reserve') {
    const sourceItem = state.reserveItems.find((item) => item.id === payload.itemId)
    if (!sourceItem || sourceItem.id === targetItem?.id) return state

    if (targetItem && sourceItem.type === 'troop' && targetItem.type === 'troop' && canMergeTroops(sourceItem, targetItem)) {
      return mergeReserveTroop(state, sourceItem, targetItem)
    }

    const withoutSource = removeReserveItem(state.reserveItems, sourceItem.id)
    const targetIndex = Math.min(index, withoutSource.length)
    if (targetItem) {
      const swapped = [...state.reserveItems]
      const sourceIndex = swapped.findIndex((item) => item.id === sourceItem.id)
      swapped[sourceIndex] = targetItem
      swapped[index] = sourceItem
      return { ...state, reserveItems: swapped }
    }
    return { ...state, reserveItems: insertReserve(withoutSource, sourceItem, targetIndex) }
  }

  const unit = getUnit(state, payload.unitId)
  const sourceSlot = getSlotByOccupant(state, payload.unitId)
  if (!unit || !sourceSlot) return state
  if (unit.kind !== 'troop') return withToast(state, '名将只能在战场格中调动')

  if (targetItem) {
    if (targetItem.type !== 'troop') return withToast(state, '预备格目标不可合成')
    if (canMergeTroops(unit, targetItem)) {
      const mergedStar = nextStar(targetItem.star)
      const troops = { ...state.troops }
      delete troops[unit.id]
      return markEffect({
        ...state,
        troops,
        slots: setSlotOccupant(state, sourceSlot.id, undefined),
        reserveItems: state.reserveItems.map((item) => (item.id === targetItem.id ? { ...targetItem, star: mergedStar } : item)),
        metrics: {
          ...state.metrics,
          mergeCount: state.metrics.mergeCount + 1,
          batchItemsUsed: state.metrics.batchItemsUsed + 1,
        },
      }, troopMergeText(targetItem.troopType, mergedStar))
    }

    const nextUnit = makeTroopFromReserve(targetItem, sourceSlot, state.elapsedSeconds)
    const troops = { ...state.troops }
    delete troops[unit.id]
    troops[nextUnit.id] = nextUnit
    return {
      ...state,
      troops,
      slots: setSlotOccupant(state, sourceSlot.id, nextUnit.id),
      reserveItems: replaceReserveItem(state.reserveItems, targetItem.id, makeReserveFromTroop(unit)),
    }
  }

  if (state.reserveItems.length >= gameConfig.reserveCapacity) return withToast(state, '预备格已满')
  const troops = { ...state.troops }
  delete troops[unit.id]
  return {
    ...state,
    troops,
    slots: setSlotOccupant(state, sourceSlot.id, undefined),
    reserveItems: insertReserve(state.reserveItems, makeReserveFromTroop(unit), index),
  }
}

function handleDrop(state: GameState, payload: DragPayload, target: DropTarget): GameState {
  if (target.type === 'reserve') return dropToReserve(state, payload, target.index)

  if (payload.source === 'reserve') {
    const item = state.reserveItems.find((candidate) => candidate.id === payload.itemId)
    if (!item) return state
    return deployReserveToSlot(state, item, target.slotId)
  }

  return moveSlotUnitToSlot(state, payload.unitId, target.slotId)
}

function stateSideId(state: GameState): SideId {
  return state.slots[0]?.sideId ?? 'player'
}

function createDebugEnemy(state: GameState, lane: LaneId, enemyType: EnemyType, progress = 0): EnemyUnit {
  const config = enemyConfig[enemyType]
  const order = Object.keys(state.enemies).length + 1
  const sideId = stateSideId(state)
  const corridor = lane === 'right' ? 'right' : lane === 'left' ? 'left' : order % 2 === 0 ? 'right' : 'left'
  return {
    id: `${sideId}-enemy-debug-${lane}-${enemyType}-${Math.round(state.elapsedSeconds * 1000)}-${Object.keys(state.enemies).length}`,
    enemyType,
    targetSide: sideId,
    entrySide: corridor,
    lane,
    corridor,
    pathId: pathIdFor(sideId, corridor),
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    gateDamage: config.gateDamage,
    coinReward: config.coinReward,
    progress: Math.min(0.99, Math.max(0, progress)),
  }
}

function applyTicks(state: GameState, seconds: number): GameState {
  let next = state
  let remaining = Math.max(0, seconds)
  while (remaining > 0) {
    const delta = Math.min(0.12, remaining)
      next = sideReducer(next, { type: 'tick', delta })
    remaining -= delta
  }
  return next
}

export function sideReducer(state: GameState, action: SideAction): GameState {
  switch (action.type) {
    case 'start':
      if (state.phase === 'idle' || state.phase === 'paused') return { ...state, phase: 'playing' }
      if (state.phase === 'won' || state.phase === 'lost') return createInitialGameState(state.seed, 'playing', stateSideId(state))
      return state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'restart':
      {
        const nextState = createInitialGameState(action.seed ?? state.seed, 'playing', stateSideId(state))
        return {
          ...nextState,
          metrics: {
            ...nextState.metrics,
            restartClicked: true,
          },
        }
      }
    case 'advanceTime':
      return applyTicks(state, action.seconds)
    case 'tick': {
      if (state.phase !== 'playing') return clearExpiredToast(state)
      const delta = action.delta * state.speedMultiplier
      const nextState = tickShovels(tickCombat(state, delta))
      return clearExpiredToast(nextState)
    }
    case 'recruit':
      return recruit(state, action.confirmed)
    case 'confirmRecruitOverwrite':
      return recruit({ ...state, pendingRecruitConfirmation: false }, true)
    case 'cancelRecruitOverwrite':
      return {
        ...state,
        pendingRecruitConfirmation: false,
        toast: '已取消补兵刷新',
        toastUntil: state.elapsedSeconds + 1.2,
      }
    case 'drop':
      return { ...handleDrop(state, action.payload, action.target), selectedUnitId: undefined }
    case 'selectSlot': {
      if (state.selectedShovel) return unlockSlotWithShovel(state, action.slotId, state.selectedShovel)
      const slot = state.slots.find((candidate) => candidate.id === action.slotId)
      return { ...state, selectedUnitId: slot?.occupantId }
    }
    case 'clearSelection':
      return { ...state, selectedUnitId: undefined }
    case 'selectAutoShovel':
      if (state.autoShovels <= 0) return withToast(state, '暂无可用铁锹')
      return { ...state, selectedShovel: { source: 'auto' }, selectedUnitId: undefined, toast: '选择锁定格解锁', toastUntil: state.elapsedSeconds + 1.8 }
    case 'selectReserveShovel':
      return {
        ...state,
        selectedShovel: { source: 'reserve', itemId: action.itemId },
        selectedUnitId: undefined,
        toast: '选择锁定格解锁',
        toastUntil: state.elapsedSeconds + 1.8,
      }
    case 'unlockSelectedSlot':
      if (!state.selectedShovel) return state
      return unlockSlotWithShovel(state, action.slotId, state.selectedShovel)
    case 'setCoins':
      return { ...state, coins: Math.max(0, action.coins) }
    case 'setGuardianHp':
      return {
        ...state,
        guardianHp: Math.max(0, action.hp),
        metrics: { ...state.metrics, guardianHpRemaining: Math.max(0, action.hp) },
      }
    case 'setEnemyHp': {
      const enemy = state.enemies[action.enemyId]
      if (!enemy) return state
      const hp = Math.max(1, action.hp)
      return {
        ...state,
        enemies: {
          ...state.enemies,
          [enemy.id]: { ...enemy, hp, maxHp: Math.max(enemy.maxHp, hp) },
        },
      }
    }
    case 'setSpeed':
      return { ...state, speedMultiplier: action.speed }
    case 'jumpWave':
      return {
        ...state,
        waveIndex: Math.min(8, Math.max(1, action.waveIndex)),
        waveElapsed: 0,
        waveBreakRemaining: 0,
        nextSpawnIndex: 0,
        spawningPausedByCap: false,
        spawnedInWave: {},
        enemies: {},
      }
    case 'spawnEnemy': {
      const enemy = createDebugEnemy(state, action.lane, action.enemyType, action.progress)
      return {
        ...state,
        phase: state.phase === 'idle' ? 'playing' : state.phase,
        enemies: {
          ...state.enemies,
          [enemy.id]: enemy,
        },
        totalSpawned: state.totalSpawned + 1,
        lastEnemySpawnedAt: state.elapsedSeconds,
        lastMeaningfulProgressAt: state.elapsedSeconds,
      }
    }
    case 'spawnWave':
      return {
        ...state,
        phase: 'playing',
        waveIndex: Math.min(8, Math.max(1, action.waveIndex)),
        waveElapsed: 0.01,
        waveBreakRemaining: 0,
        nextSpawnIndex: 0,
        spawningPausedByCap: false,
        spawnedInWave: {},
        enemies: {},
      }
    case 'debugAddTroop':
      return addReserveItem(state, { id: debugItemId(state, action.troopType), type: 'troop', troopType: action.troopType, star: action.star ?? 1 })
    case 'debugAddGeneral':
      return addReserveItem(state, { id: debugItemId(state, action.generalId), type: 'general', generalId: action.generalId })
    case 'debugAddWeapon':
      return addReserveItem(state, { id: debugItemId(state, action.weaponId), type: 'weapon', weaponId: action.weaponId })
    case 'debugAddShovel':
      return { ...state, autoShovels: Math.min(gameConfig.maxStoredShovels, state.autoShovels + 1) }
    case 'debugAddAutoShovel':
      return { ...state, autoShovels: Math.min(gameConfig.maxStoredShovels, state.autoShovels + 1) }
    case 'setReserveItems':
      return { ...state, reserveItems: action.items.slice(0, gameConfig.reserveCapacity) }
    case 'unlockAllSlots':
      return {
        ...state,
        slots: state.slots.map((slot) => ({ ...slot, unlocked: true })),
        nextShovelAt: Number.POSITIVE_INFINITY,
        selectedShovel: undefined,
        metrics: { ...state.metrics, maxUnlockedSlots: 16, unlockedSlotCount: 16 },
      }
    case 'clearReserve':
      return { ...state, reserveItems: [] }
    case 'toggleEnemyHp':
      return { ...state, showEnemyHp: !state.showEnemyHp }
    case 'toggleDps':
      return { ...state, showDps: !state.showDps }
    case 'toggleCompendium':
      return { ...state, showCompendium: !state.showCompendium }
    case 'toggleDebug':
      return { ...state, showDebug: !state.showDebug }
    case 'recordRuntimeError':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          runtimeErrorCount: state.metrics.runtimeErrorCount + 1,
        },
      }
    case 'noop':
    default:
      return state
  }
}

export function createInitialDuelState(seed = 'duel-seed-001', phase: DuelGameState['phase'] = 'idle'): DuelGameState {
  const player = createInitialGameState(seed, phase === 'idle' ? 'idle' : 'playing', 'player')
  const ghost = createInitialGameState(seed, phase === 'idle' ? 'idle' : 'playing', 'ghost')
  return {
    phase,
    seed,
    elapsedSeconds: 0,
    speedMultiplier: 1,
    player,
    ghost,
    selectedSideId: 'player',
    selectedUnitId: undefined,
    selectedShovel: undefined,
    toastUntil: 0,
    ghostReplay: {
      fileId: 'normal-001',
      difficulty: 'normal',
      nextActionIndex: 0,
      failedActionCount: 0,
      failures: [],
      completed: false,
    },
    ghostId: 'ghost-normal-001',
    ghostName: '演武对手',
    ghostAvatarId: 'avatar_03',
    ghostDifficulty: 'normal',
    showCompendium: false,
    showDebug: false,
    showEnemyHp: false,
    showDps: false,
    metrics: {
      matchId: `match-${seed}`,
      seed,
      ghostId: 'ghost-normal-001',
      ghostDifficulty: 'normal',
      result: 'playing',
      durationSeconds: 0,
      playerGuardianHp: gameConfig.guardianMaxHp,
      ghostGuardianHp: gameConfig.guardianMaxHp,
      firstAttackAtByType: {},
      hpLeadChangeCount: 0,
      closestHpDifference: 0,
      playerRecruitCount: 0,
      ghostRecruitCount: 0,
      playerMergeCount: 0,
      ghostMergeCount: 0,
      ghostActionCount: 0,
      ghostActionFailureCount: 0,
      playerTotalKills: 0,
      ghostTotalKills: 0,
      playerLeaks: 0,
      ghostLeaks: 0,
      restartClicked: false,
      consoleErrorCount: 0,
    },
  }
}

export const gameReducer = sideReducer

export { createInitialGameState, duelConfig }
