import { duelConfig, gameConfig } from '../config/gameConfig'
import { waves } from '../game/waves'
import type { DuelGameState } from '../types/game'

interface TopHudProps {
  state: DuelGameState
}

function hpPercent(hp: number) {
  return Math.max(0, Math.round((hp / gameConfig.guardianMaxHp) * 100))
}

function leadStatus(state: DuelGameState) {
  const lead = state.player.guardianHp / gameConfig.guardianMaxHp - state.ghost.guardianHp / gameConfig.guardianMaxHp
  if (lead >= duelConfig.aheadThreshold) return '领先'
  if (lead <= duelConfig.behindThreshold) return '落后'
  return '势均力敌'
}

export function TopHud({ state }: TopHudProps) {
  const wave = waves[state.player.waveIndex - 1]
  const ghostHpPercent = hpPercent(state.ghost.guardianHp)
  const countdown =
    state.player.waveBreakRemaining > 0
      ? `下波 ${Math.ceil(state.player.waveBreakRemaining)}`
      : wave?.index === 8
        ? 'Boss 来袭'
        : ''

  return (
    <header className="top-hud duel-hud">
      <div className="ghost-card">
        <span className="ghost-avatar" aria-hidden="true">影</span>
        <div>
          <strong data-testid="ghost-name">{state.ghostName}</strong>
          <small data-testid="ghost-difficulty">{state.ghostDifficulty}</small>
        </div>
      </div>
      <div className="hud-time">
        <strong data-testid="duel-time" data-value={ghostHpPercent} data-elapsed={state.elapsedSeconds}>
          对方貂蝉 {ghostHpPercent}%
        </strong>
        {countdown && <span>{countdown}</span>}
        <i data-testid="duel-phase" data-value={state.phase}>{state.phase}</i>
        <i data-testid="wave-counter" data-value={state.player.waveIndex}>第{state.player.waveIndex}/{waves.length}波</i>
        <i data-testid="ghost-next-action-index" data-value={state.ghostReplay.nextActionIndex}>{state.ghostReplay.nextActionIndex}</i>
        <i data-testid="ghost-action-failure-count" data-value={state.ghostReplay.failedActionCount}>{state.ghostReplay.failedActionCount}</i>
        <i data-testid="last-enemy-moved-at" data-value={Math.max(state.player.lastEnemyMovedAt, state.ghost.lastEnemyMovedAt)}>
          {Math.max(state.player.lastEnemyMovedAt, state.ghost.lastEnemyMovedAt)}
        </i>
      </div>
      <div className="lead-pill" data-testid="lead-status" data-value={leadStatus(state)}>
        {leadStatus(state)}
      </div>
    </header>
  )
}
