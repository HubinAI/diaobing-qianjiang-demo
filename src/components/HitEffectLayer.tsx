import { gameConfig } from '../config/gameConfig'
import { arcPolygonPoints, localToWorldPoint, stripPolygonPoints } from '../game/attackGeometryView'
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
          const end = localToWorldPoint(trace.geometry, trace.geometry.lengthRatio ?? 0, 0)
          const impactProgress = Math.min(1, Math.max(0, (elapsedSeconds - trace.createdAt) / Math.max(0.01, trace.impactAt - trace.createdAt)))
          return (
            <div key={trace.id} className={`spear-trace-wrap ${trace.resolved ? 'is-resolved' : ''}`} aria-hidden="true">
              <span
                className="spear-thrust-body"
                style={{
                  left: `${trace.sourcePoint.x * 100}%`,
                  top: `${trace.sourcePoint.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${trace.geometry.facingAngleDeg}deg)`,
                }}
                data-testid="spear-thrust-body"
                data-facing-angle-deg={trace.geometry.facingAngleDeg}
                data-source-unit-id={trace.sourceUnitId}
              />
              <svg className="attack-area-effect spear-beam-effect" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon
                  className="attack-strip-effect spear-beam-shell"
                  points={stripPolygonPoints(trace.geometry)}
                  data-testid="attack-trace-thrust"
                  data-geometry={JSON.stringify(trace.geometry)}
                  data-impact-progress={impactProgress.toFixed(3)}
                  {...commonProps}
                />
                <line
                  className="spear-beam-core"
                  x1={trace.sourcePoint.x * 100}
                  y1={trace.sourcePoint.y * 100}
                  x2={end.x * 100}
                  y2={end.y * 100}
                  data-testid="spear-beam-core"
                  data-facing-angle-deg={trace.geometry.facingAngleDeg}
                  data-length-ratio={trace.geometry.lengthRatio}
                  data-width-ratio={trace.geometry.widthRatio}
                />
                {trace.targetImpacts.map((impact) => (
                  <circle
                    key={`${trace.id}-${impact.enemyId}`}
                    className="spear-impact-marker"
                    cx={impact.point.x * 100}
                    cy={impact.point.y * 100}
                    r={1.7 - Math.min(0.8, impact.order * 0.16)}
                    style={{ animationDelay: `${impact.order * 45}ms` }}
                    data-testid="spear-impact-marker"
                    data-target-enemy-id={impact.enemyId}
                    data-impact-order={impact.order}
                    data-damage-ratio={impact.damageRatio}
                  />
                ))}
              </svg>
              {trace.targetImpacts.length >= 2 && (
                <span
                  className="pierce-count"
                  style={{ left: `${trace.sourcePoint.x * 100}%`, top: `${trace.sourcePoint.y * 100}%` }}
                  data-testid="pierce-count"
                  data-pierce-count={trace.targetImpacts.length}
                >
                  贯穿×{trace.targetImpacts.length}
                </span>
              )}
            </div>
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
            style={{
              left: `${x}%`,
              top: `${y}%`,
              animationDelay: effect.kind === 'thrust' && effect.order !== undefined ? `${effect.order * 45}ms` : undefined,
              marginLeft: effect.kind === 'thrust' && effect.order !== undefined ? `${(effect.order % 2 === 0 ? -1 : 1) * Math.min(10, 3 + effect.order * 2)}px` : undefined,
              marginTop: effect.kind === 'thrust' && effect.order !== undefined ? `${Math.min(8, effect.order * 2)}px` : undefined,
            }}
            data-testid={`damage-number-${effect.id}`}
            data-impact-order={effect.order ?? ''}
            data-damage-ratio={effect.damageRatio ?? ''}
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
