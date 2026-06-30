import { enemyConfig } from '../config/gameConfig'
import { samplePathPercent } from '../game/paths'
import type { EnemyUnit } from '../types/game'

interface EnemyLaneProps {
  enemy: EnemyUnit
  showHp: boolean
}

export function EnemyLane({ enemy, showHp }: EnemyLaneProps) {
  const position = samplePathPercent(enemy.pathId, enemy.progress)
  const hpPercent = Math.max(0, (enemy.hp / enemy.maxHp) * 100)
  const config = enemyConfig[enemy.enemyType]
  const damaged = hpPercent < 99

  return (
    <div
      className={`enemy-marker enemy-${enemy.enemyType} ${damaged ? 'is-damaged' : ''}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      data-testid={`enemy-${enemy.id}`}
      data-target-side={enemy.targetSide}
      data-entry-side={enemy.entrySide}
      data-enemy-id={enemy.id}
      data-lane={enemy.lane}
      data-corridor={enemy.corridor}
      data-path-id={enemy.pathId}
      data-progress={enemy.progress}
      data-x={position.x / 100}
      data-y={position.y / 100}
      data-hp={enemy.hp}
    >
      <strong>{config.icon}</strong>
      <span className={`enemy-hp is-visible ${showHp || damaged || enemy.enemyType === 'boss' ? 'is-emphasized' : ''}`}>
        <i style={{ width: `${hpPercent}%` }} />
      </span>
    </div>
  )
}
