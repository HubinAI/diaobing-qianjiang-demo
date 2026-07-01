import { gameConfig } from '../config/gameConfig'
import type { DuelGameState } from '../types/game'

interface GuardianGateProps {
  state: DuelGameState
}

function hpPercent(hp: number) {
  return Math.max(0, (hp / gameConfig.guardianMaxHp) * 100)
}

export function GuardianGate({ state }: GuardianGateProps) {
  const playerHp = hpPercent(state.player.guardianHp)
  const crisisText = playerHp <= 30 ? '危机' : '守稳'

  return (
    <section className={`guardian-gate duel-guardian-gate ${playerHp <= 30 ? 'is-danger' : ''}`} aria-label="我方貂蝉状态" data-testid="player-guardian-zone">
      <div className={`diaochan-avatar ${playerHp <= 30 ? 'is-danger' : ''}`} data-testid="diaochan-avatar">
        <span>貂</span>
      </div>
      <div className="guardian-info">
        <div className="guardian-title">
          <span>我方貂蝉</span>
          <strong data-testid="player-guardian-hp">{Math.ceil(playerHp)}%</strong>
        </div>
        <div className="hp-track">
          <div className="hp-fill" style={{ width: `${playerHp}%` }} />
        </div>
      </div>
      <strong className="guardian-crisis" data-testid="player-guardian-crisis" data-value={crisisText}>
        {crisisText}
      </strong>
    </section>
  )
}
