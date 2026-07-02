import { gameConfig, generalConfig, troopConfig } from '../config/gameConfig'
import type { BoardUnit, DeploymentSlot as Slot, DragPayload } from '../types/game'

interface DeploymentSlotProps {
  slot: Slot
  unit?: BoardUnit
  isUnlockable: boolean
  isInvalid: boolean
  showDps: boolean
  isSelected: boolean
  isBuffed: boolean
  isDraggable: boolean
  onDragStart: (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => void
  onSlotClick: (slotId: string) => void
}

function stars(count: number) {
  return '★'.repeat(count)
}

function dps(unit: BoardUnit) {
  const troopType = unit.kind === 'troop' ? unit.troopType : generalConfig[unit.generalId].troopType
  const config = troopConfig[troopType]
  const multiplier = unit.kind === 'troop' ? gameConfig.starMultiplier[unit.star] : gameConfig.generalStarMultiplier[unit.star]
  return ((config.attack * multiplier) / config.attackInterval).toFixed(1)
}

function troopTypeOf(unit: BoardUnit) {
  return unit.kind === 'troop' ? unit.troopType : generalConfig[unit.generalId].troopType
}

function slotTestId(slotId: string) {
  return `${slotId.replace('-deploy-', '-deploy-slot-').replace('-lock-', '-lock-slot-')}`
}

export function DeploymentSlot({ slot, unit, isUnlockable, isInvalid, showDps, isSelected, isBuffed, isDraggable, onDragStart, onSlotClick }: DeploymentSlotProps) {
  const unitType = unit ? troopTypeOf(unit) : undefined
  const unitLabel = unit ? (unit.kind === 'troop' ? troopConfig[unit.troopType].icon : generalConfig[unit.generalId].label) : ''
  return (
    <div
      className={`deployment-slot ${slot.unlocked ? 'is-open' : 'is-locked'} ${isUnlockable ? 'is-unlockable' : ''} ${isInvalid ? 'is-invalid' : ''} ${isSelected ? 'is-selected' : ''} ${isBuffed ? 'is-buffed' : ''}`}
      style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
      data-drop-kind={isDraggable ? 'slot' : undefined}
      data-slot-id={slot.id}
      data-side-id={slot.sideId}
      data-slot-zone={slot.zone}
      data-slot-status={slot.unlocked ? 'active' : 'locked'}
      data-adjacent-road-id={slot.adjacentRoadId}
      data-slot-x={slot.x}
      data-slot-y={slot.y}
      data-facing-angle-deg={slot.facingAngleDeg}
      data-testid={slotTestId(slot.id)}
      data-unit-id={unit?.id ?? ''}
      data-unit-kind={unit?.kind ?? ''}
      data-unit-type={unitType ?? ''}
      data-unit-star={unit?.star ?? ''}
      data-selected={isSelected ? 'true' : 'false'}
      data-buffed={isBuffed ? 'true' : 'false'}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (!isDraggable || !unit) return
        onDragStart({ source: 'slot', unitId: unit.id }, event)
      }}
    >
      {slot.unlocked ? (
        unit ? (
          <div
            className={`unit-token ${isDraggable ? 'is-draggable' : 'is-ghost-locked'} ${unit.kind === 'troop' ? troopConfig[unit.troopType].colorClass : generalConfig[unit.generalId].colorClass} ${unit.kind === 'general' ? `portrait-${unit.generalId}` : ''} ${unit.kind === 'general' && unit.equippedWeapon ? 'is-equipped' : ''}`}
            data-testid={unit.kind === 'general' ? `${slot.sideId}-general-${unit.id}` : `${slot.sideId}-unit-${unit.id}`}
          >
            <strong data-testid={`unit-label-${unit.id}`}>{unitLabel}</strong>
            <small data-testid={`star-indicator-${unit.id}`}>{showDps ? `DPS ${dps(unit)}` : stars(unit.star)}</small>
          </div>
        ) : (
          <span className="slot-vacant" aria-label="可放置兵种" />
        )
      ) : (
        <span className="slot-lock" aria-hidden="true">🔒</span>
      )}
    </div>
  )
}
