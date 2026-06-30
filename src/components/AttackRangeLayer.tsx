import { attackShapeConfig, gameConfig, generalConfig } from '../config/gameConfig'
import { getAttackGeometryForUnit, geometryData, troopTypeForUnit } from '../game/attackGeometry'
import { arcPolygonPoints, facingArrowPoints, pointStyle, stripPolygonPoints } from '../game/attackGeometryView'
import type { BoardUnit, GameState } from '../types/game'

interface AttackRangeLayerProps {
  state: GameState
  units: Record<string, BoardUnit>
  selectedUnitId?: string
}

export function AttackRangeLayer({ state, units, selectedUnitId }: AttackRangeLayerProps) {
  const unit = selectedUnitId ? units[selectedUnitId] : undefined
  if (!unit) return null

  const troopType = troopTypeForUnit(unit)
  const geometry = getAttackGeometryForUnit(state, unit)
  if (!geometry) return null

  const shapeConfig = attackShapeConfig[troopType]
  const buffedTroopType = unit.kind === 'general' ? generalConfig[unit.generalId].troopType : undefined
  const arrow = facingArrowPoints(geometry)
  const title = unit.kind === 'general' ? generalConfig[unit.generalId].label : troopType === 'blade' ? '刀' : troopType === 'spear' ? '枪' : '弓'
  const maxText =
    troopType === 'archer'
      ? '优先攻击高威胁目标'
      : troopType === 'spear'
        ? `最多贯穿${shapeConfig.maxTargets}个目标`
        : `最多命中${shapeConfig.maxTargets}个目标`

  return (
    <>
      <svg
        className={`attack-range-layer range-${troopType}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-testid="attack-range-layer"
        data-selected-unit-id={unit.id}
        data-buffed-troop-type={buffedTroopType ?? ''}
        data-geometry={geometryData(geometry)}
      >
        <g data-testid="attack-range-overlay" data-range-type={troopType} data-attack-shape={geometry.shape}>
          {geometry.shape === 'circle' && (
            <ellipse
              className="attack-range-overlay attack-range-circle"
              cx={geometry.origin.x * 100}
              cy={geometry.origin.y * 100}
              rx={(geometry.radiusRatio ?? 0) * 100}
              ry={((geometry.radiusRatio ?? 0) / gameConfig.battlefieldHeightToWidthRatio) * 100}
              data-testid="attack-range-circle"
              data-range-type={troopType}
              data-radius-ratio={geometry.radiusRatio}
            />
          )}
          {geometry.shape === 'strip' && (
            <polygon
              className="attack-range-overlay attack-range-strip"
              points={stripPolygonPoints(geometry)}
              data-testid="attack-range-strip"
              data-range-type={troopType}
              data-length-ratio={geometry.lengthRatio}
              data-width-ratio={geometry.widthRatio}
            />
          )}
          {geometry.shape === 'arc' && (
            <polygon
              className="attack-range-overlay attack-range-arc"
              points={arcPolygonPoints(geometry)}
              data-testid="attack-range-arc"
              data-range-type={troopType}
              data-radius-ratio={geometry.arcRadiusRatio}
              data-arc-angle-deg={geometry.arcAngleDeg}
            />
          )}
        </g>
        <line
          className="unit-facing-arrow"
          x1={arrow.start.x * 100}
          y1={arrow.start.y * 100}
          x2={arrow.end.x * 100}
          y2={arrow.end.y * 100}
          data-testid="unit-facing-arrow"
          data-facing-angle-deg={geometry.facingAngleDeg}
        />
      </svg>
      <div className="unit-info-popover" style={pointStyle({ x: Math.min(0.76, geometry.origin.x + 0.025), y: Math.max(0.08, geometry.origin.y - 0.18) })} data-testid="unit-info-popover">
        <strong>{title}</strong>
        <span>{'★'.repeat(unit.star)}</span>
        <span>{shapeConfig.rangeLabel}</span>
        <span>{shapeConfig.damageLabel}</span>
        <small>{maxText}</small>
        {unit.kind === 'general' && buffedTroopType && <small>强化{attackShapeConfig[buffedTroopType].rangeLabel}</small>}
      </div>
    </>
  )
}
