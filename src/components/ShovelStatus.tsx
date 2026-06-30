import { gameConfig } from '../config/gameConfig'
import type { GameState } from '../types/game'

interface ShovelStatusProps {
  state: GameState
  onSelect: () => void
}

export function ShovelStatus({ state, onSelect }: ShovelStatusProps) {
  const allUnlocked = state.slots.every((slot) => slot.unlocked)
  const next = allUnlocked
    ? '已全部解锁'
    : state.autoShovels >= gameConfig.maxStoredShovels
      ? '已满'
      : `${Math.max(0, Math.ceil(state.nextShovelAt - state.elapsedSeconds))}秒`

  return (
    <button
      className={`shovel-status ${state.selectedShovel?.source === 'auto' ? 'is-selected' : ''}`}
      type="button"
      onClick={onSelect}
      data-testid="shovel-status"
    >
      <strong>铁锹 {state.autoShovels}/{gameConfig.maxStoredShovels}</strong>
      <span>{next}</span>
    </button>
  )
}
