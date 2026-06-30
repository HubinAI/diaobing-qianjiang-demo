import { gameConfig } from '../config/gameConfig'
import { getUnlockedCount, hasLockedSlots } from './engine'
import type { GameState } from '../types/game'

function lockGroup(slotId: string) {
  if (slotId.includes('left-locked')) return slotId.slice(0, slotId.indexOf('left-locked')) + 'left-locked'
  if (slotId.includes('center-locked')) return slotId.slice(0, slotId.indexOf('center-locked')) + 'center-locked'
  if (slotId.includes('right-locked')) return slotId.slice(0, slotId.indexOf('right-locked')) + 'right-locked'
  return undefined
}

export function canUnlockSlot(state: GameState, slotId: string) {
  const slot = state.slots.find((candidate) => candidate.id === slotId)
  const group = lockGroup(slotId)
  if (!slot || !group || slot.unlocked) return false

  const lockedInGroup = state.slots
    .filter((candidate) => candidate.id.startsWith(group) && !candidate.unlocked)
    .sort((a, b) => a.index - b.index)

  return lockedInGroup[0]?.id === slot.id
}

export function tickShovels(state: GameState): GameState {
  if (!hasLockedSlots(state)) {
    return {
      ...state,
      selectedShovel: undefined,
      nextShovelAt: Number.POSITIVE_INFINITY,
    }
  }

  if (state.autoShovels >= gameConfig.maxStoredShovels || state.elapsedSeconds < state.nextShovelAt) {
    return state
  }

  const autoShovels = Math.min(gameConfig.maxStoredShovels, state.autoShovels + 1)
  return {
    ...state,
    autoShovels,
    nextShovelAt:
      autoShovels >= gameConfig.maxStoredShovels
        ? Number.POSITIVE_INFINITY
        : state.elapsedSeconds + gameConfig.shovelRegenSeconds,
  }
}

export function unlockSlotWithShovel(state: GameState, slotId: string, source: { source: 'auto' } | { source: 'reserve'; itemId: string }): GameState {
  const slot = state.slots.find((candidate) => candidate.id === slotId)
  if (!slot) return state
  if (slot.unlocked) return { ...state, toast: '该格已解锁', toastUntil: state.elapsedSeconds + 1.8 }
  if (!canUnlockSlot(state, slotId)) {
    return { ...state, toast: '请先解锁相邻格', toastUntil: state.elapsedSeconds + 1.8 }
  }

  if (source.source === 'auto' && state.autoShovels <= 0) {
    return { ...state, toast: '暂无可用铁锹', toastUntil: state.elapsedSeconds + 1.8 }
  }

  if (source.source === 'reserve' && !state.reserveItems.some((item) => item.id === source.itemId && item.type === 'shovel')) {
    return state
  }

  const slots = state.slots.map((candidate) => (candidate.id === slotId ? { ...candidate, unlocked: true } : candidate))
  const reserveItems =
    source.source === 'reserve' ? state.reserveItems.filter((item) => item.id !== source.itemId) : state.reserveItems
  const autoShovels = source.source === 'auto' ? state.autoShovels - 1 : state.autoShovels
  const nextShovelAt =
    source.source === 'auto' && state.autoShovels >= gameConfig.maxStoredShovels
      ? state.elapsedSeconds + gameConfig.shovelRegenSeconds
      : state.nextShovelAt
  const stillLocked = slots.some((candidate) => !candidate.unlocked)

  return {
    ...state,
    slots,
    reserveItems,
    autoShovels,
    nextShovelAt: stillLocked ? nextShovelAt : Number.POSITIVE_INFINITY,
    selectedShovel: undefined,
    toast: stillLocked ? '格子已解锁' : '已全部解锁',
    toastUntil: state.elapsedSeconds + 1.8,
    lastEffect: { id: `${state.elapsedSeconds}-unlock`, text: '解锁', at: state.elapsedSeconds },
    metrics: {
      ...state.metrics,
      batchItemsUsed: state.metrics.batchItemsUsed + (source.source === 'reserve' ? 1 : 0),
      shovelUseCount: state.metrics.shovelUseCount + 1,
      unlockedSlotCount: getUnlockedCount({ ...state, slots }),
      maxUnlockedSlots: Math.max(state.metrics.maxUnlockedSlots, getUnlockedCount({ ...state, slots })),
    },
  }
}
