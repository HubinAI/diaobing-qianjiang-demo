import { duelConfig, gameConfig, getRecruitCost } from '../config/gameConfig'
import { getGhostFileByDifficulty } from '../ghost/ghostRepository'
import type {
  DeployPayload,
  EquipWeaponPayload,
  GameCommand,
  GhostAction,
  MergePayload,
  MovePayload,
  RecruitBatchPayload,
  RecruitItemRef,
  UnlockSlotPayload,
  UpgradeGeneralPayload,
} from '../ghost/ghostTypes'
import { createInitialDuelState, sideReducer, type SideAction } from '../state/gameStore'
import type { DragPayload, DropTarget, DuelGameState, GameState, ReserveItem, SideId } from '../types/game'

export type GameAction =
  | { type: 'noop' }
  | { type: 'hydrate'; state: DuelGameState }
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
  | { type: 'selectSlot'; sideId?: SideId; slotId: string }
  | { type: 'clearSelection' }
  | { type: 'selectAutoShovel' }
  | { type: 'selectReserveShovel'; itemId: string }
  | { type: 'unlockSelectedSlot'; slotId: string }
  | { type: 'setCoins'; coins: number }
  | { type: 'setSideCoins'; sideId: SideId; coins: number }
  | { type: 'setGuardianHp'; sideId: SideId; hp: number }
  | { type: 'setEnemyHp'; sideId: SideId; enemyId: string; hp: number }
  | { type: 'setSpeed'; speed: number }
  | { type: 'setGhostDifficulty'; difficulty: 'easy' | 'normal' | 'hard' }
  | { type: 'jumpGhostAction' }
  | { type: 'jumpWave'; waveIndex: number }
  | { type: 'spawnEnemy'; sideId: SideId; entrySide: 'left' | 'right'; enemyType: 'normal' | 'fast' | 'heavy' | 'boss'; progress?: number }
  | { type: 'spawnWave'; waveIndex: number }
  | { type: 'debugAddTroop'; troopType: 'blade' | 'spear' | 'archer'; star?: 1 | 2 | 3 | 4 | 5 }
  | { type: 'debugAddGeneral'; generalId: 'guanyu' | 'zhaoyun' | 'huangzhong' }
  | { type: 'debugAddWeapon'; weaponId: 'greenDragonBlade' | 'dragonSpear' | 'sunsetBow' }
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

function sidePhase(phase: DuelGameState['phase']): GameState['phase'] {
  if (phase === 'won') return 'won'
  if (phase === 'lost' || phase === 'draw') return 'lost'
  return phase
}

function syncSide(state: DuelGameState, sideId: SideId): GameState {
  const side = state[sideId]
  return {
    ...side,
    phase: sidePhase(state.phase),
    elapsedSeconds: state.elapsedSeconds,
    speedMultiplier: state.speedMultiplier,
    selectedUnitId: state.selectedSideId === sideId ? state.selectedUnitId : undefined,
    selectedShovel: state.selectedShovel?.sideId === sideId ? (
      state.selectedShovel.source === 'auto'
        ? { source: 'auto' }
        : { source: 'reserve', itemId: state.selectedShovel.itemId }
    ) : undefined,
    showCompendium: state.showCompendium,
    showDebug: state.showDebug,
    showEnemyHp: state.showEnemyHp,
    showDps: state.showDps,
  }
}

function withSide(state: DuelGameState, sideId: SideId, side: GameState): DuelGameState {
  return {
    ...state,
    [sideId]: side,
    selectedUnitId: side.selectedUnitId,
    selectedSideId: side.selectedUnitId ? sideId : state.selectedSideId,
    selectedShovel: side.selectedShovel
      ? side.selectedShovel.source === 'auto'
        ? { source: 'auto', sideId }
        : { source: 'reserve', sideId, itemId: side.selectedShovel.itemId }
      : state.selectedShovel?.sideId === sideId
        ? undefined
        : state.selectedShovel,
    pendingRecruitConfirmationSide: side.pendingRecruitConfirmation ? sideId : state.pendingRecruitConfirmationSide === sideId ? undefined : state.pendingRecruitConfirmationSide,
    toast: side.toast ?? state.toast,
    toastUntil: Math.max(state.toastUntil, side.toastUntil),
    lastEffect: side.lastEffect ? { ...side.lastEffect, sideId } : state.lastEffect,
  }
}

function applySideAction(state: DuelGameState, sideId: SideId, action: SideAction): DuelGameState {
  return withSide(state, sideId, sideReducer(syncSide(state, sideId), action))
}

function recruitItemMatches(item: ReserveItem, ref: RecruitItemRef) {
  if (item.batchIndex !== ref.batchIndex || item.recruitSlotIndex !== ref.recruitSlotIndex) return false
  if (ref.expectedType === 'general') return item.type === 'general' && (!ref.expectedGeneralId || item.generalId === ref.expectedGeneralId)
  if (ref.expectedType === 'weapon') return item.type === 'weapon' && (!ref.expectedWeaponId || item.weaponId === ref.expectedWeaponId)
  return item.type === 'troop' && item.troopType === ref.expectedType && (!ref.expectedStar || item.star === ref.expectedStar)
}

function findRecruitItem(side: GameState, ref: RecruitItemRef) {
  return side.reserveItems.find((item) => recruitItemMatches(item, ref))
}

function slotUnitDrop(side: GameState, slotId: string): DragPayload | undefined {
  const slot = side.slots.find((candidate) => candidate.id === slotId)
  return slot?.occupantId ? { source: 'slot', unitId: slot.occupantId } : undefined
}

function commandFailure(state: DuelGameState, command: GameCommand, reason: string) {
  if (command.source !== 'ghost') return { ok: false, state, reason }
  const failure = {
    actionId: command.actionId ?? `${command.type}-${state.elapsedSeconds}`,
    at: state.elapsedSeconds,
    reason: reason === 'insufficient_coins' || reason === 'item_mismatch' || reason === 'slot_occupied' || reason === 'slot_locked' || reason === 'merge_mismatch' || reason === 'ruleset_mismatch' ? reason : 'unknown',
  } as const
  return {
    ok: false,
    reason,
    state: {
      ...state,
      ghostReplay: {
        ...state.ghostReplay,
        failedActionCount: state.ghostReplay.failedActionCount + 1,
        failures: [...state.ghostReplay.failures, failure],
      },
      metrics: {
        ...state.metrics,
        ghostActionFailureCount: state.metrics.ghostActionFailureCount + 1,
      },
    },
  }
}

export function executeGameCommand(state: DuelGameState, command: GameCommand) {
  const side = syncSide(state, command.sideId)

  if (command.type === 'recruit_batch') {
    const payload = command.payload as RecruitBatchPayload
    if (payload.expectedBatchIndex !== side.metrics.batchRecruitCount) return commandFailure(state, command, 'item_mismatch')
    if (side.coins < getRecruitCost(side.metrics.batchRecruitCount)) return commandFailure(state, command, 'insufficient_coins')
    const next = applySideAction(state, command.sideId, {
      type: 'recruit',
      confirmed: command.source === 'ghost' ? true : payload.confirmed,
    })
    const nextSide = next[command.sideId]
    if (nextSide.pendingRecruitConfirmation) return { ok: false, state: next, reason: 'confirmation_required' }
    return { ok: nextSide.metrics.batchRecruitCount === side.metrics.batchRecruitCount + 1, state: next }
  }

  if (command.type === 'deploy') {
    const payload = command.payload as DeployPayload
    const item = findRecruitItem(side, payload.item)
    if (!item) return commandFailure(state, command, 'item_mismatch')
    const slot = side.slots.find((candidate) => candidate.id === payload.targetSlotId)
    if (!slot) return commandFailure(state, command, 'unknown')
    if (!slot.unlocked) return commandFailure(state, command, 'slot_locked')
    const next = applySideAction(state, command.sideId, {
      type: 'drop',
      payload: { source: 'reserve', itemId: item.id },
      target: { type: 'slot', slotId: payload.targetSlotId },
    })
    return { ok: !next[command.sideId].reserveItems.some((candidate) => candidate.id === item.id), state: next }
  }

  if (command.type === 'move') {
    const payload = command.payload as MovePayload
    const drag = slotUnitDrop(side, payload.fromSlotId)
    if (!drag) return commandFailure(state, command, 'item_mismatch')
    const target = side.slots.find((slot) => slot.id === payload.targetSlotId)
    if (!target) return commandFailure(state, command, 'unknown')
    if (!target.unlocked) return commandFailure(state, command, 'slot_locked')
    const next = applySideAction(state, command.sideId, { type: 'drop', payload: drag, target: { type: 'slot', slotId: payload.targetSlotId } })
    return { ok: true, state: next }
  }

  if (command.type === 'merge') {
    const payload = command.payload as MergePayload
    const drag = slotUnitDrop(side, payload.fromSlotId)
    if (!drag) return commandFailure(state, command, 'item_mismatch')
    const next = applySideAction(state, command.sideId, { type: 'drop', payload: drag, target: { type: 'slot', slotId: payload.targetSlotId } })
    const nextSide = next[command.sideId]
    const targetSlot = nextSide.slots.find((slot) => slot.id === payload.targetSlotId)
    const targetUnit = targetSlot?.occupantId ? nextSide.troops[targetSlot.occupantId] ?? nextSide.generals[targetSlot.occupantId] : undefined
    if (!targetUnit || targetUnit.star !== payload.expectedResultStar) return commandFailure(next, command, 'merge_mismatch')
    return { ok: true, state: next }
  }

  if (command.type === 'unlock_slot') {
    const payload = command.payload as UnlockSlotPayload
    const slot = side.slots.find((candidate) => candidate.id === payload.targetSlotId)
    if (!slot) return commandFailure(state, command, 'unknown')
    if (slot.unlocked) return { ok: true, state }
    if (side.autoShovels <= 0) return commandFailure(state, command, 'insufficient_coins')
    const selected = applySideAction(state, command.sideId, { type: 'selectAutoShovel' })
    const next = applySideAction(selected, command.sideId, { type: 'unlockSelectedSlot', slotId: payload.targetSlotId })
    return { ok: next[command.sideId].slots.some((candidate) => candidate.id === payload.targetSlotId && candidate.unlocked), state: next }
  }

  if (command.type === 'upgrade_general') {
    const payload = command.payload as UpgradeGeneralPayload
    const item = findRecruitItem(side, payload.item)
    if (!item) return commandFailure(state, command, 'item_mismatch')
    const next = applySideAction(state, command.sideId, {
      type: 'drop',
      payload: { source: 'reserve', itemId: item.id },
      target: { type: 'slot', slotId: payload.targetGeneralSlotId },
    })
    const targetSlot = next[command.sideId].slots.find((slot) => slot.id === payload.targetGeneralSlotId)
    const targetUnit = targetSlot?.occupantId ? next[command.sideId].generals[targetSlot.occupantId] : undefined
    if (!targetUnit || targetUnit.star !== payload.expectedResultStar) return commandFailure(next, command, 'merge_mismatch')
    return { ok: true, state: next }
  }

  if (command.type === 'equip_weapon') {
    const payload = command.payload as EquipWeaponPayload
    const item = findRecruitItem(side, payload.item)
    if (!item) return commandFailure(state, command, 'item_mismatch')
    const next = applySideAction(state, command.sideId, {
      type: 'drop',
      payload: { source: 'reserve', itemId: item.id },
      target: { type: 'slot', slotId: payload.targetGeneralSlotId },
    })
    return { ok: true, state: next }
  }

  return commandFailure(state, command, 'unknown')
}

function executeGhostActions(state: DuelGameState): DuelGameState {
  const file = getGhostFileByDifficulty(state.ghostDifficulty)
  let next = state
  let nextActionIndex = next.ghostReplay.nextActionIndex

  while (nextActionIndex < file.actions.length && file.actions[nextActionIndex].at <= next.elapsedSeconds) {
    const action = file.actions[nextActionIndex] as GhostAction
    const result = executeGameCommand(next, {
      sideId: 'ghost',
      source: 'ghost',
      type: action.type,
      payload: action.payload,
      actionId: action.id,
    })
    next = result.state ?? next
    nextActionIndex += 1
    next = {
      ...next,
      ghostReplay: {
        ...next.ghostReplay,
        nextActionIndex,
        completed: nextActionIndex >= file.actions.length,
        lastActionId: action.id,
      },
      metrics: {
        ...next.metrics,
        ghostActionCount: next.metrics.ghostActionCount + 1,
      },
    }
  }

  return next
}

function sumLeaks(side: GameState) {
  return Object.values(side.metrics.leakedByLane).reduce((sum, count) => sum + count, 0)
}

function settleDuel(state: DuelGameState): DuelGameState {
  const playerDead = state.player.guardianHp <= 0
  const ghostDead = state.ghost.guardianHp <= 0
  let phase = state.phase

  if (playerDead && ghostDead) phase = 'draw'
  else if (ghostDead) phase = 'won'
  else if (playerDead) phase = 'lost'
  else if (state.elapsedSeconds >= duelConfig.maxMatchSeconds) {
    const playerRatio = state.player.guardianHp / gameConfig.guardianMaxHp
    const ghostRatio = state.ghost.guardianHp / gameConfig.guardianMaxHp
    if (playerRatio > ghostRatio) phase = 'won'
    else if (ghostRatio > playerRatio) phase = 'lost'
    else if (sumLeaks(state.player) < sumLeaks(state.ghost)) phase = 'won'
    else if (sumLeaks(state.ghost) < sumLeaks(state.player)) phase = 'lost'
    else phase = 'draw'
  }

  if (phase === state.phase) return state

  return {
    ...state,
    phase,
    player: { ...state.player, phase: phase === 'won' ? 'won' : phase === 'playing' ? 'playing' : 'lost' },
    ghost: { ...state.ghost, phase: phase === 'lost' ? 'won' : phase === 'playing' ? 'playing' : 'lost' },
    metrics: {
      ...state.metrics,
      result: phase === 'won' || phase === 'lost' || phase === 'draw' ? phase : 'playing',
      durationSeconds: state.elapsedSeconds,
      playerGuardianHp: state.player.guardianHp,
      ghostGuardianHp: state.ghost.guardianHp,
    },
  }
}

function updateDuelMetrics(state: DuelGameState): DuelGameState {
  const hpLead = state.player.guardianHp / gameConfig.guardianMaxHp - state.ghost.guardianHp / gameConfig.guardianMaxHp
  return {
    ...state,
    metrics: {
      ...state.metrics,
      durationSeconds: state.elapsedSeconds,
      playerGuardianHp: state.player.guardianHp,
      ghostGuardianHp: state.ghost.guardianHp,
      closestHpDifference: Math.min(Math.abs(hpLead), state.metrics.closestHpDifference === 0 ? Math.abs(hpLead) : state.metrics.closestHpDifference),
      playerRecruitCount: state.player.metrics.recruitCount,
      ghostRecruitCount: state.ghost.metrics.recruitCount,
      playerMergeCount: state.player.metrics.mergeCount,
      ghostMergeCount: state.ghost.metrics.mergeCount,
      playerTotalKills: state.player.metrics.totalKills,
      ghostTotalKills: state.ghost.metrics.totalKills,
      playerLeaks: sumLeaks(state.player),
      ghostLeaks: sumLeaks(state.ghost),
    },
  }
}

function tickDuel(state: DuelGameState, deltaSeconds: number): DuelGameState {
  if (state.phase !== 'playing') return state
  const delta = deltaSeconds * state.speedMultiplier
  let next: DuelGameState = {
    ...state,
    elapsedSeconds: state.elapsedSeconds + delta,
  }
  next = {
    ...next,
    player: sideReducer({ ...syncSide(next, 'player'), phase: 'playing' }, { type: 'tick', delta }),
    ghost: sideReducer({ ...syncSide(next, 'ghost'), phase: 'playing' }, { type: 'tick', delta }),
  }
  next = executeGhostActions(next)
  next = updateDuelMetrics(next)
  return settleDuel(next)
}

function advanceDuel(state: DuelGameState, seconds: number): DuelGameState {
  let next = state
  let remaining = Math.max(0, seconds)
  while (remaining > 0) {
    const delta = Math.min(0.12, remaining)
    next = duelReducer(next, { type: 'tick', delta })
    remaining -= delta
  }
  return next
}

function applyPlayerCommand(state: DuelGameState, command: Omit<GameCommand, 'sideId' | 'source'>) {
  const result = executeGameCommand(state, { ...command, sideId: 'player', source: 'player' })
  return result.state ?? state
}

export function duelReducer(state: DuelGameState, action: GameAction): DuelGameState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'start':
      return state.phase === 'idle' || state.phase === 'paused'
        ? { ...state, phase: 'playing', player: { ...state.player, phase: 'playing' }, ghost: { ...state.ghost, phase: 'playing' } }
        : state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw'
          ? createInitialDuelState(state.seed, 'playing')
          : state
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
    case 'restart':
      return { ...createInitialDuelState(action.seed ?? state.seed, 'playing'), metrics: { ...createInitialDuelState(action.seed ?? state.seed, 'playing').metrics, restartClicked: true } }
    case 'tick':
      return tickDuel(state, action.delta)
    case 'advanceTime':
      return advanceDuel(state, action.seconds)
    case 'recruit':
      return applyPlayerCommand(state, {
        type: 'recruit_batch',
        payload: { expectedBatchIndex: state.player.metrics.batchRecruitCount, confirmed: action.confirmed },
      })
    case 'confirmRecruitOverwrite':
      return applyPlayerCommand(state, {
        type: 'recruit_batch',
        payload: { expectedBatchIndex: state.player.metrics.batchRecruitCount, confirmed: true },
      })
    case 'cancelRecruitOverwrite':
      return applySideAction(state, 'player', { type: 'cancelRecruitOverwrite' })
    case 'drop': {
      if (action.payload.source === 'reserve') {
        const payload = action.payload
        const item = state.player.reserveItems.find((candidate) => candidate.id === payload.itemId)
        if (item?.batchIndex !== undefined && item.recruitSlotIndex !== undefined && action.target.type === 'slot' && item.type !== 'shovel') {
          return applyPlayerCommand(state, {
            type: 'deploy',
            payload: {
              item: {
                batchIndex: item.batchIndex,
                recruitSlotIndex: item.recruitSlotIndex,
                expectedType: item.type === 'troop' ? item.troopType : item.type,
                expectedStar: item.type === 'troop' ? item.star : undefined,
                expectedGeneralId: item.type === 'general' ? item.generalId : undefined,
                expectedWeaponId: item.type === 'weapon' ? item.weaponId : undefined,
              },
              targetSlotId: action.target.slotId,
            },
          })
        }
      }
      return applySideAction(state, 'player', { type: 'drop', payload: action.payload, target: action.target })
    }
    case 'selectSlot':
      return applySideAction({ ...state, selectedSideId: action.sideId ?? 'player' }, action.sideId ?? 'player', { type: 'selectSlot', slotId: action.slotId })
    case 'clearSelection':
      return { ...applySideAction(applySideAction(state, 'player', { type: 'clearSelection' }), 'ghost', { type: 'clearSelection' }), selectedUnitId: undefined, selectedShovel: undefined }
    case 'selectAutoShovel':
      return applySideAction(state, 'player', { type: 'selectAutoShovel' })
    case 'selectReserveShovel':
      return applySideAction(state, 'player', { type: 'selectReserveShovel', itemId: action.itemId })
    case 'unlockSelectedSlot':
      return applyPlayerCommand(state, { type: 'unlock_slot', payload: { targetSlotId: action.slotId } })
    case 'setCoins':
      return applySideAction(state, 'player', { type: 'setCoins', coins: action.coins })
    case 'setSideCoins':
      return applySideAction(state, action.sideId, { type: 'setCoins', coins: action.coins })
    case 'setGuardianHp':
      return applySideAction(state, action.sideId, { type: 'setGuardianHp', hp: action.hp })
    case 'setEnemyHp':
      return applySideAction(state, action.sideId, { type: 'setEnemyHp', enemyId: action.enemyId, hp: action.hp })
    case 'setSpeed':
      return { ...state, speedMultiplier: action.speed, player: { ...state.player, speedMultiplier: action.speed }, ghost: { ...state.ghost, speedMultiplier: action.speed } }
    case 'setGhostDifficulty': {
      const file = getGhostFileByDifficulty(action.difficulty)
      const next = createInitialDuelState(file.seed, state.phase === 'idle' ? 'idle' : 'playing')
      return {
        ...next,
        speedMultiplier: state.speedMultiplier,
        player: { ...next.player, speedMultiplier: state.speedMultiplier },
        ghost: { ...next.ghost, speedMultiplier: state.speedMultiplier },
        ghostId: file.ghostId,
        ghostName: file.displayName,
        ghostAvatarId: file.avatarId,
        ghostDifficulty: file.difficulty,
        ghostReplay: {
          ...next.ghostReplay,
          fileId: file.ghostId,
          difficulty: file.difficulty,
        },
        metrics: {
          ...next.metrics,
          ghostId: file.ghostId,
          ghostDifficulty: file.difficulty,
        },
      }
    }
    case 'jumpGhostAction': {
      const file = getGhostFileByDifficulty(state.ghostDifficulty)
      const nextAction = file.actions[state.ghostReplay.nextActionIndex]
      if (!nextAction) return state
      const playableState = state.phase === 'playing' ? state : { ...state, phase: 'playing' as const }
      return advanceDuel(playableState, Math.max(0.01, nextAction.at - state.elapsedSeconds + 0.01))
    }
    case 'spawnEnemy':
      return applySideAction(state, action.sideId, { type: 'spawnEnemy', lane: action.entrySide, enemyType: action.enemyType, progress: action.progress })
    case 'spawnWave':
      return {
        ...applySideAction(applySideAction(state, 'player', { type: 'spawnWave', waveIndex: action.waveIndex }), 'ghost', { type: 'spawnWave', waveIndex: action.waveIndex }),
        phase: 'playing',
      }
    case 'jumpWave':
      return applySideAction(applySideAction(state, 'player', action), 'ghost', action)
    case 'debugAddTroop':
    case 'debugAddGeneral':
    case 'debugAddWeapon':
    case 'debugAddShovel':
    case 'debugAddAutoShovel':
    case 'setReserveItems':
    case 'unlockAllSlots':
    case 'clearReserve':
      return applySideAction(state, 'player', action)
    case 'toggleEnemyHp':
      return { ...state, showEnemyHp: !state.showEnemyHp, player: { ...state.player, showEnemyHp: !state.showEnemyHp }, ghost: { ...state.ghost, showEnemyHp: !state.showEnemyHp } }
    case 'toggleDps':
      return { ...state, showDps: !state.showDps, player: { ...state.player, showDps: !state.showDps }, ghost: { ...state.ghost, showDps: !state.showDps } }
    case 'toggleCompendium':
      return { ...state, showCompendium: !state.showCompendium }
    case 'toggleDebug':
      return { ...state, showDebug: !state.showDebug }
    case 'recordRuntimeError':
      return { ...state, metrics: { ...state.metrics, consoleErrorCount: state.metrics.consoleErrorCount + 1 } }
    case 'noop':
    default:
      return state
  }
}
