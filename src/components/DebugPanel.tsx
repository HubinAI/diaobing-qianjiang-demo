import { useState } from 'react'
import { generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'
import type { GameAction } from '../game/commandBus'
import type { GhostDifficulty } from '../ghost/ghostTypes'
import type { DuelGameState } from '../types/game'

interface DebugPanelProps {
  state: DuelGameState
  onToggle: () => void
  dispatch: React.Dispatch<GameAction>
}

export function DebugPanel({ state, onToggle, dispatch }: DebugPanelProps) {
  const [coinInput, setCoinInput] = useState(String(Math.floor(state.player.coins)))
  const [seedInput, setSeedInput] = useState(state.seed)
  const ghostDifficulties: GhostDifficulty[] = ['easy', 'normal', 'hard']

  const exportDebugJson = () => {
    const data = JSON.stringify({
      seed: state.seed,
      ghostReplay: state.ghostReplay,
      metrics: state.metrics,
      player: {
        hp: state.player.guardianHp,
        coins: state.player.coins,
        recruitBatchIndex: state.player.metrics.batchRecruitCount,
      },
      ghost: {
        hp: state.ghost.guardianHp,
        coins: state.ghost.coins,
        recruitBatchIndex: state.ghost.metrics.batchRecruitCount,
      },
    }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ghost-duel-${state.seed}-${state.ghostDifficulty}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <aside className={`debug-panel ${state.showDebug ? 'is-open' : ''}`} data-testid="debug-panel">
      <button type="button" className="debug-toggle" onClick={onToggle} title="调试面板">
        D
      </button>
      {state.showDebug && (
        <div className="debug-body">
          <div className="debug-stats">
            <span>matchSeed {state.seed}</span>
            <span>phase {state.phase}</span>
            <span>elapsed {state.elapsedSeconds.toFixed(1)}</span>
            <span>playerHp {Math.ceil(state.player.guardianHp)}</span>
            <span>ghostHp {Math.ceil(state.ghost.guardianHp)}</span>
            <span>playerEnemyCount {Object.keys(state.player.enemies).length}</span>
            <span>ghostEnemyCount {Object.keys(state.ghost.enemies).length}</span>
            <span>playerRecruitBatchIndex {state.player.metrics.batchRecruitCount}</span>
            <span>ghostRecruitBatchIndex {state.ghost.metrics.batchRecruitCount}</span>
            <span>ghostId {state.ghostId}</span>
            <span>ghostDifficulty {state.ghostDifficulty}</span>
            <span>ghostNextActionIndex {state.ghostReplay.nextActionIndex}</span>
            <span>ghostActionFailureCount {state.ghostReplay.failedActionCount}</span>
            <span>ghostLastAction {state.ghostReplay.lastActionId ?? '-'}</span>
            <span>consoleErrorCount {state.metrics.consoleErrorCount}</span>
          </div>

          <label>
            银币
            <span className="debug-inline">
              <input value={coinInput} onChange={(event) => setCoinInput(event.target.value)} inputMode="numeric" />
              <button type="button" onClick={() => dispatch({ type: 'setCoins', coins: Number(coinInput) || 0 })}>
                设置
              </button>
            </span>
          </label>

          <label>
            随机 seed
            <span className="debug-inline">
              <input value={seedInput} onChange={(event) => setSeedInput(event.target.value)} />
              <button type="button" onClick={() => dispatch({ type: 'restart', seed: seedInput || state.seed })}>
                重开
              </button>
            </span>
          </label>

          <div className="debug-row">
            {[0.5, 1, 2, 4].map((speed) => (
              <button key={speed} type="button" className={state.speedMultiplier === speed ? 'is-active' : ''} onClick={() => dispatch({ type: 'setSpeed', speed })}>
                {speed}x
              </button>
            ))}
          </div>

          <div className="debug-row">
            {ghostDifficulties.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                className={state.ghostDifficulty === difficulty ? 'is-active' : ''}
                onClick={() => dispatch({ type: 'setGhostDifficulty', difficulty })}
              >
                {difficulty}
              </button>
            ))}
            <button type="button" onClick={() => dispatch({ type: 'jumpGhostAction' })}>下一幽灵事件</button>
            <button type="button" onClick={exportDebugJson}>导出JSON</button>
          </div>

          <div className="debug-row">
            <button type="button" onClick={() => dispatch({ type: 'pause' })}>暂停</button>
            <button type="button" onClick={() => dispatch({ type: 'resume' })}>恢复</button>
            <button type="button" onClick={() => dispatch({ type: 'spawnEnemy', sideId: 'player', entrySide: 'left', enemyType: 'normal', progress: 0 })}>我方左敌</button>
            <button type="button" onClick={() => dispatch({ type: 'spawnEnemy', sideId: 'player', entrySide: 'right', enemyType: 'normal', progress: 0 })}>我方右敌</button>
            <button type="button" onClick={() => dispatch({ type: 'spawnEnemy', sideId: 'ghost', entrySide: 'left', enemyType: 'normal', progress: 0 })}>对方左敌</button>
            <button type="button" onClick={() => dispatch({ type: 'spawnEnemy', sideId: 'ghost', entrySide: 'right', enemyType: 'normal', progress: 0 })}>对方右敌</button>
          </div>

          <div className="debug-row">
            <button type="button" onClick={() => dispatch({ type: 'setGuardianHp', sideId: 'player', hp: state.player.guardianHp - 10 })}>我方HP-10</button>
            <button type="button" onClick={() => dispatch({ type: 'setGuardianHp', sideId: 'ghost', hp: state.ghost.guardianHp - 10 })}>对方HP-10</button>
          </div>

          <div className="debug-row">
            {Array.from({ length: 8 }, (_, index) => (
              <button key={index + 1} type="button" onClick={() => dispatch({ type: 'jumpWave', waveIndex: index + 1 })}>
                波{index + 1}
              </button>
            ))}
          </div>

          <div className="debug-row">
            {Object.keys(troopConfig).map((troopType) => (
              <button key={troopType} type="button" onClick={() => dispatch({ type: 'debugAddTroop', troopType: troopType as keyof typeof troopConfig })}>
                {troopConfig[troopType as keyof typeof troopConfig].label}
              </button>
            ))}
          </div>

          <div className="debug-row">
            {Object.keys(generalConfig).map((generalId) => (
              <button key={generalId} type="button" onClick={() => dispatch({ type: 'debugAddGeneral', generalId: generalId as keyof typeof generalConfig })}>
                {generalConfig[generalId as keyof typeof generalConfig].label}
              </button>
            ))}
          </div>

          <div className="debug-row">
            {Object.keys(weaponConfig).map((weaponId) => (
              <button key={weaponId} type="button" onClick={() => dispatch({ type: 'debugAddWeapon', weaponId: weaponId as keyof typeof weaponConfig })}>
                {weaponConfig[weaponId as keyof typeof weaponConfig].icon}
              </button>
            ))}
          </div>

          <div className="debug-row">
            <button type="button" onClick={() => dispatch({ type: 'debugAddAutoShovel' })}>自动铁锹</button>
            <button type="button" onClick={() => dispatch({ type: 'unlockAllSlots' })}>全解锁</button>
            <button type="button" onClick={() => dispatch({ type: 'clearReserve' })}>清预备</button>
            <button type="button" onClick={() => dispatch({ type: 'toggleEnemyHp' })}>{state.showEnemyHp ? '隐藏HP' : '显示HP'}</button>
            <button type="button" onClick={() => dispatch({ type: 'toggleDps' })}>{state.showDps ? '隐藏DPS' : '显示DPS'}</button>
          </div>

          <button className="debug-restart" type="button" onClick={() => dispatch({ type: 'restart', seed: state.seed })}>
            重新开始
          </button>
        </div>
      )}
    </aside>
  )
}
