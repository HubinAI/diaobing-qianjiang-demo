import { getRecruitCost } from '../config/gameConfig'
import type { GameState } from '../types/game'

interface RecruitButtonProps {
  state: GameState
  onRecruit: () => void
}

export function RecruitButton({ state, onRecruit }: RecruitButtonProps) {
  const cost = getRecruitCost(state.metrics.batchRecruitCount)
  const disabled = state.coins < cost
  const recruitIndex = state.metrics.batchRecruitCount + 1

  return (
    <button className="recruit-button" type="button" disabled={disabled} onClick={onRecruit} data-testid="recruit-button">
      <strong>{disabled ? `需${cost}银` : `补兵 第${recruitIndex}次`}</strong>
      <span>消耗{cost}银币 随机6格</span>
    </button>
  )
}
