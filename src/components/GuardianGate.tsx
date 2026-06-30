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
  const ghostHp = hpPercent(state.ghost.guardianHp)

  return (
    <section className="guardian-gate duel-guardian-gate" aria-label="双方守护目标">
      <div className={`diaochan-avatar ghost-diaochan ${ghostHp <= 30 ? 'is-danger' : ''}`} data-testid="ghost-diaochan-avatar">
        <span>貂</span>
      </div>
      <div className="guardian-info">
        <div className="guardian-title">
          <span>对方貂蝉</span>
          <strong>{Math.ceil(ghostHp)}%</strong>
        </div>
        <div className="hp-track ghost-track">
          <div className="hp-fill ghost-fill" style={{ width: `${ghostHp}%` }} />
        </div>
      </div>
      <div className="guardian-info">
        <div className="guardian-title">
          <span>我方貂蝉</span>
          <strong>{Math.ceil(playerHp)}%</strong>
        </div>
        <div className="hp-track">
          <div className="hp-fill" style={{ width: `${playerHp}%` }} />
        </div>
      </div>
      <div className={`diaochan-avatar ${playerHp <= 30 ? 'is-danger' : ''}`} data-testid="diaochan-avatar">
        <span>貂</span>
      </div>
    </section>
  )
}
