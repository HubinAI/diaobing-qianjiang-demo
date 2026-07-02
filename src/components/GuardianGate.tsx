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
      {/* 城墙背景 + 貂蝉立绘 + 血条融合 */}
      <div className="gate-wall">
        {/* 城门楼屋顶 + 血量百分比 */}
        <div className="gate-roof">
          <div className="gate-roof-top">
            <span className="diaochan-hp-badge" data-testid="player-guardian-hp">{Math.ceil(playerHp)}%</span>
          </div>
          <div className="gate-roof-eaves" />
        </div>
        {/* 城墙主体 */}
        <div className="gate-tower">
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
        </div>
        {/* 城门拱洞 + 貂蝉立绘 + 血条 */}
        <div className="gate-arch">
          <div className="gate-arch-inner">
            {/* 貂蝉人物立绘 + 头顶血条 */}
            <div
              className={`diaochan-figure ${isCritical ? 'is-critical' : isDanger ? 'is-danger' : ''}`}
              data-testid="diaochan-avatar"
            >
              {/* 头顶血条 */}
              <div className="diaochan-hp-bar">
                <div className="diaochan-hp-track">
                  <div
                    className={`diaochan-hp-fill ${isCritical ? 'hp-critical' : isDanger ? 'hp-danger' : ''}`}
                    style={{ width: `${playerHp}%` }}
                  />
                </div>
              </div>
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
    </section>
  )
}
