import { getRecruitCost } from '../config/gameConfig'
import type { GameState } from '../types/game'

interface RecruitButtonProps {
  state: GameState
  onRecruit: () => void
}

export function RecruitButton({ state, onRecruit }: RecruitButtonProps) {
  const cost = getRecruitCost(state.metrics.batchRecruitCount)
  const disabled = state.coins < cost

  return (
    <button className="recruit-button" type="button" disabled={disabled} onClick={onRecruit} data-testid="recruit-button">
      <strong>补兵</strong>
      <span>消耗{cost}银币刷新6格</span>
    </button>
  )
}
