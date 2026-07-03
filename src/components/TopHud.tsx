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

/** Q版小头像 — 简约版本，用于顶栏 */
function MiniChibi({ mood }: { mood: 'idle' | 'worry' | 'cheer' }) {
  return (
    <span className="mini-chibi" aria-hidden="true">
      <span className="mini-chibi-face">
        <span className={`mini-chibi-eyes mood-${mood}`}>
          <span className="mini-eye" />
          <span className="mini-eye" />
        </span>
        <span className="mini-chibi-mouth" />
      </span>
      <span className="mini-chibi-hair" />
    </span>
  )
}

export function TopHud({ state }: TopHudProps) {
  const waveTable = state.player.waveTable
  const totalWaves = waveTable.length
  const wave = waveTable[state.player.waveIndex - 1]
  const playerHpPercent = hpPercent(state.player.guardianHp)
  const ghostHpPercent = hpPercent(state.ghost.guardianHp)
  const isBossWave = wave?.index === totalWaves
  const countdown =
    state.player.waveBreakRemaining > 0
      ? `下波 ${Math.ceil(state.player.waveBreakRemaining)}s`
      : isBossWave
        ? 'Boss 来袭'
        : ''
  const ghostMood = ghostHpPercent <= 30 ? 'worry' : ghostHpPercent >= 70 ? 'cheer' : 'idle'
  const playerMood = playerHpPercent <= 30 ? 'worry' : playerHpPercent >= 70 ? 'cheer' : 'idle'

  return (
    <header className="top-hud duel-hud">
      <div className="hud-guardian-card player-card">
        <span className="guardian-label">我方</span>
        <MiniChibi mood={playerMood} />
        <span className="guardian-hp-text">{playerHpPercent}%</span>
      </div>
      <div className="hud-center">
        <div className="ghost-card">
          <span className="ghost-avatar" aria-hidden="true">影</span>
          <strong data-testid="ghost-name">{ghostRankLabel(state.ghostDifficulty)}对手</strong>
        </div>
        {countdown && <span className="wave-alert">{countdown}</span>}
      </div>
      <div className="hud-guardian-card ghost-card-hp">
        <span className="guardian-label">对方</span>
        <MiniChibi mood={ghostMood} />
        <span className="guardian-hp-text">{ghostHpPercent}%</span>
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
