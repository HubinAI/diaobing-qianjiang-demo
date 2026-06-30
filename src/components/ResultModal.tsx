import type { DuelGameState } from '../types/game'

interface ResultModalProps {
  state: DuelGameState
  onRestart: () => void
}

export function ResultModal({ state, onRestart }: ResultModalProps) {
  if (state.phase !== 'won' && state.phase !== 'lost' && state.phase !== 'draw') return null

  const title = state.phase === 'won' ? '竞速胜利' : state.phase === 'lost' ? '竞速失败' : '平局'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="result-modal">
      <section className="modal-panel result-panel">
        <h2>{title}</h2>
        <div className="result-grid">
          <span>用时</span>
          <strong>{state.elapsedSeconds.toFixed(1)}秒</strong>
          <span>我方貂蝉</span>
          <strong>{Math.ceil(state.player.guardianHp)}</strong>
          <span>对方貂蝉</span>
          <strong>{Math.ceil(state.ghost.guardianHp)}</strong>
          <span>我方击杀</span>
          <strong>{state.player.metrics.totalKills}</strong>
          <span>对方击杀</span>
          <strong>{state.ghost.metrics.totalKills}</strong>
          <span>我方补兵</span>
          <strong>{state.player.metrics.batchRecruitCount}</strong>
          <span>对方补兵</span>
          <strong>{state.ghost.metrics.batchRecruitCount}</strong>
          <span>幽灵事件</span>
          <strong>{state.ghostReplay.nextActionIndex}</strong>
          <span>失败事件</span>
          <strong>{state.ghostReplay.failedActionCount}</strong>
        </div>
        <button className="replay-button" type="button" data-testid="restart-button" onClick={onRestart}>
          再来一局
        </button>
      </section>
    </div>
  )
}
