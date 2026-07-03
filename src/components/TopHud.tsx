import { duelConfig, gameConfig, APP_VERSION } from '../config/gameConfig'
import type { DuelGameState } from '../types/game'

interface TopHudProps {
  state: DuelGameState
}

function hpPercent(hp: number) {
  return Math.max(0, Math.round((hp / gameConfig.guardianMaxHp) * 100))
}

function ghostRankLabel(difficulty: string): string {
  if (difficulty === 'easy') return '青铜'
  if (difficulty === 'hard') return '黄金'
  return '白银'
}

export function TopHud({ state }: TopHudProps) {
  const waveTable = state.player.waveTable
  const totalWaves = waveTable.length
  const wave = waveTable[state.player.waveIndex - 1]
  const ghostHpPercent = hpPercent(state.ghost.guardianHp)
  const isBossWave = wave?.index === totalWaves
  const countdown =
    state.player.waveBreakRemaining > 0
      ? `下波 ${Math.ceil(state.player.waveBreakRemaining)}s`
      : isBossWave
        ? 'Boss 来袭'
        : ''

  return (
    <header className="top-hud duel-hud">
      <div className="ghost-card">
        <span className="ghost-avatar" aria-hidden="true">影</span>
        <div>
          <strong data-testid="ghost-name">{ghostRankLabel(state.ghostDifficulty)}对手</strong>
        </div>
      </div>
      <div className="hud-center">
        {/* 对方貂蝉血条 — 放在中间 */}
        <div className="hud-ghost-guardian">
          <span className="hud-guardian-label">对方</span>
          <div className="hud-guardian-hp-bar">
            <div className="hud-guardian-hp-track">
              <div className="hud-guardian-hp-fill" style={{ width: `${ghostHpPercent}%` }} />
            </div>
            <span className="hud-guardian-hp-text">{ghostHpPercent}%</span>
          </div>
        </div>
        {countdown && <span className="wave-alert">{countdown}</span>}
      </div>
      <div className="hud-wave">
        <span className="version-label">{APP_VERSION}</span>
        <span className="wave-badge" data-testid="wave-counter" data-value={state.player.waveIndex}>
          第{state.player.waveIndex}/{totalWaves}波
        </span>
      </div>
    </header>
  )
}
