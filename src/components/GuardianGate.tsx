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
  const isCritical = playerHp <= 20
  const isDanger = playerHp <= 30 && playerHp > 20

  return (
    <section
      className={`city-gate ${isCritical ? 'is-critical' : isDanger ? 'is-danger' : ''}`}
      aria-label="我方貂蝉状态"
      data-testid="player-guardian-zone"
    >
      {/* 城墙背景 */}
      <div className="gate-wall">
        {/* 城门楼屋顶 */}
        <div className="gate-roof">
          <div className="gate-roof-top" />
          <div className="gate-roof-eaves" />
        </div>
        {/* 城墙主体 */}
        <div className="gate-tower">
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
        </div>
        {/* 城门拱洞 */}
        <div className="gate-arch">
          <div className="gate-arch-inner">
            {/* 貂蝉立绘 */}
            <div
              className={`diaochan-figure ${isCritical ? 'is-critical' : isDanger ? 'is-danger' : ''}`}
              data-testid="diaochan-avatar"
            >
              <div className="diaochan-body">
                <div className="diaochan-head">
                  <div className="diaochan-hair" />
                  <div className="diaochan-face" />
                  <div className="diaochan-crown" />
                </div>
                <div className="diaochan-torso">
                  <div className="diaochan-robe" />
                  <div className="diaochan-sash" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 血条 */}
      <div className="gate-hp-bar">
        <div className="gate-hp-label">
          <span>貂蝉</span>
          <strong data-testid="player-guardian-hp">{Math.ceil(playerHp)}%</strong>
        </div>
        <div className="hp-track gate-hp-track">
          <div
            className={`hp-fill ${isCritical ? 'hp-critical' : isDanger ? 'hp-danger' : ''}`}
            style={{ width: `${playerHp}%` }}
          />
        </div>
      </div>
    </section>
  )
}
