import { gameConfig } from '../config/gameConfig'
import type { DuelGameState } from '../types/game'

interface ResultModalProps {
  state: DuelGameState
  onRestart: () => void
}

function hpPercent(hp: number) {
  return Math.max(0, Math.round((hp / gameConfig.guardianMaxHp) * 100))
}

function resultEmoji(phase: string) {
  if (phase === 'won') return '🏆'
  if (phase === 'lost') return '💔'
  return '🤝'
}

function resultTitle(phase: string) {
  if (phase === 'won') return '大获全胜'
  if (phase === 'lost') return '功败垂成'
  return '旗鼓相当'
}

function resultSubtitle(state: DuelGameState) {
  if (state.phase === 'won') {
    const remainingPercent = hpPercent(state.player.guardianHp)
    return `貂蝉尚存 ${remainingPercent}% 生命，敌军已被全数击溃`
  }
  if (state.phase === 'lost') {
    const opponentRemaining = hpPercent(state.ghost.guardianHp)
    const diff = hpPercent(state.ghost.guardianHp) - hpPercent(state.player.guardianHp)
    if (diff <= 10) return `仅差一步！对方貂蝉剩余 ${opponentRemaining}%，下次调整策略再战`
    return `对方貂蝉剩余 ${opponentRemaining}%，加强部署和招募节奏`
  }
  return '双方同时耗尽，胜负只在毫厘之间'
}

function highestStarUnit(state: DuelGameState): string {
  let maxStar = 0
  let label = '无'
  for (const unit of Object.values(state.player.troops)) {
    if (unit.star > maxStar) {
      maxStar = unit.star
      label = `${'★'.repeat(unit.star)} 士兵`
    }
  }
  for (const unit of Object.values(state.player.generals)) {
    if (unit.star > maxStar) {
      maxStar = unit.star
      label = `${'★'.repeat(unit.star)} 名将`
    }
  }
  return label
}

export function ResultModal({ state, onRestart }: ResultModalProps) {
  if (state.phase !== 'won' && state.phase !== 'lost' && state.phase !== 'draw') return null

  const playerHp = hpPercent(state.player.guardianHp)
  const ghostHp = hpPercent(state.ghost.guardianHp)
  const isWin = state.phase === 'won'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="result-modal">
      <section className={`modal-panel result-panel ${isWin ? 'is-win' : 'is-lose'}`}>
        <div className="result-header">
          <span className="result-emoji">{resultEmoji(state.phase)}</span>
          <h2 className={isWin ? 'text-gold' : 'text-danger'}>{resultTitle(state.phase)}</h2>
          <p className="result-subtitle">{resultSubtitle(state)}</p>
        </div>

        <div className="result-hp-comparison">
          <div className="hp-bar-group">
            <span className="hp-label">我方貂蝉</span>
            <div className="hp-track result-hp-track">
              <div className="hp-fill hp-fill-player" style={{ width: `${playerHp}%` }} />
            </div>
            <strong>{playerHp}%</strong>
          </div>
          <div className="hp-bar-group">
            <span className="hp-label">对方貂蝉</span>
            <div className="hp-track result-hp-track">
              <div className="hp-fill hp-fill-ghost" style={{ width: `${ghostHp}%` }} />
            </div>
            <strong>{ghostHp}%</strong>
          </div>
        </div>

        <div className="result-stats-row">
          <div className="result-stat">
            <span className="stat-value">{state.elapsedSeconds.toFixed(0)}s</span>
            <span className="stat-label">用时</span>
          </div>
          <div className="result-stat">
            <span className="stat-value">{state.player.metrics.totalKills}</span>
            <span className="stat-label">击杀</span>
          </div>
          <div className="result-stat">
            <span className="stat-value">{state.player.metrics.mergeCount}</span>
            <span className="stat-label">合成</span>
          </div>
          <div className="result-stat">
            <span className="stat-value">{highestStarUnit(state)}</span>
            <span className="stat-label">最高战力</span>
          </div>
        </div>

        <button className="replay-button" type="button" data-testid="restart-button" onClick={onRestart}>
          ⚔️ 再来一局
        </button>

        {state.phase === 'lost' && (
          <p className="result-encouragement">每局招募和波次都不同，换个策略试试！</p>
        )}
      </section>
    </div>
  )
}
