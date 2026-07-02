import { forwardRef } from 'react'
import { getRecruitCost } from '../config/gameConfig'
import type { GameState } from '../types/game'

interface RecruitButtonProps {
  state: GameState
  onRecruit: () => void
}

export const RecruitButton = forwardRef<HTMLButtonElement, RecruitButtonProps>(function RecruitButton({ state, onRecruit }, ref) {
  const cost = getRecruitCost(state.metrics.batchRecruitCount)
  const disabled = state.coins < cost

  return (
    <button className="recruit-button" type="button" disabled={disabled} onClick={onRecruit} data-testid="recruit-button" ref={ref}>
      <strong>补兵</strong>
      <span className="recruit-cost">
        <i className="coin-icon" aria-hidden="true">◈</i>
        {cost}
      </span>
    </button>
  )
})
