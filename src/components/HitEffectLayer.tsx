import { gameConfig } from '../config/gameConfig'
import { arcPolygonPoints, stripPolygonPoints } from '../game/attackGeometryView'
import { samplePathPercent } from '../game/paths'
import type { AttackTrace, CoinFlyEffect, HitEffect } from '../types/game'

interface HitEffectLayerProps {
  effects: HitEffect[]
  traces: AttackTrace[]
  coins: CoinFlyEffect[]
  elapsedSeconds: number
}

function coinPosition(effect: CoinFlyEffect, elapsedSeconds: number) {
  const start = samplePathPercent(effect.pathId, effect.progress)
  const target = { x: 88, y: 6 }
  const ratio = Math.min(1, Math.max(0, (elapsedSeconds - effect.createdAt) / Math.max(0.01, effect.collectAt - effect.createdAt)))
  const eased = ratio * ratio * (3 - 2 * ratio)
  return {
    x: start.x + (target.x - start.x) * eased,
    y: start.y + (target.y - start.y) * eased,
  }
}

export function HitEffectLayer({ effects, traces, coins, elapsedSeconds }: HitEffectLayerProps) {
  return (
    <>
      {traces.map((trace) => {
        const travelRatio = Math.min(1, Math.max(0.12, (elapsedSeconds - trace.createdAt) / Math.max(0.01, trace.impactAt - trace.createdAt)))
        const commonProps = {
          'data-projectile-id': trace.id,
          'data-source-unit-id': trace.sourceUnitId,
          'data-target-enemy-ids': trace.targetEnemyIds.join(','),
          'data-damage': Math.round(trace.damage),
          'data-impact-at': trace.impactAt,
          'data-resolved': trace.resolved ? 'true' : 'false',
        }

        if (trace.geometry.shape === 'strip') {
          return (
            <svg key={trace.id} className={`attack-area-effect ${trace.resolved ? 'is-resolved' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon
                className="attack-strip-effect"
                points={stripPolygonPoints(trace.geometry)}
                data-testid="attack-trace-thrust"
                data-geometry={JSON.stringify(trace.geometry)}
                {...commonProps}
              />
            </svg>
          )
        }

        if (trace.geometry.shape === 'arc') {
          return (
            <svg key={trace.id} className={`attack-area-effect ${trace.resolved ? 'is-resolved' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon
                className="attack-arc-effect"
                points={arcPolygonPoints(trace.geometry)}
                data-testid="attack-trace-slash"
                data-geometry={JSON.stringify(trace.geometry)}
                {...commonProps}
              />
            </svg>
          )
        }

        const source = { x: trace.sourcePoint.x * 100, y: trace.sourcePoint.y * 100 }
        const target = { x: trace.targetPoint.x * 100, y: trace.targetPoint.y * 100 }
        const dx = target.x - source.x
        const dy = (target.y - source.y) * gameConfig.battlefieldHeightToWidthRatio
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return (
          <span
            key={trace.id}
            className={`attack-trace trace-${trace.attackType} ${trace.resolved ? 'is-resolved' : ''}`}
            style={{ left: `${source.x}%`, top: `${source.y}%`, width: `${length * travelRatio}%`, transform: `rotate(${angle}deg)` }}
            data-testid={`attack-trace-${trace.attackType}`}
            data-geometry={JSON.stringify(trace.geometry)}
            {...commonProps}
          />
        )
      })}
      {effects.map((effect) => {
        const { x, y } = samplePathPercent(effect.pathId, effect.progress)
        return (
          <span
            key={effect.id}
            className={`hit-effect hit-${effect.kind}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            data-testid={`damage-number-${effect.id}`}
          >
            <i className="hit-ring" />
            <i className="hit-slash" />
            {effect.text}
          </span>
        )
      })}
      {coins.map((coin) => {
        const { x, y } = coinPosition(coin, elapsedSeconds)
        return (
          <span
            key={coin.id}
            className={`coin-fly ${coin.collected ? 'is-collected' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            data-testid={`coin-fly-${coin.id}`}
            data-amount={coin.amount}
            data-collected={coin.collected ? 'true' : 'false'}
          >
            银
          </span>
        )
      })}
    </>
  )
}
