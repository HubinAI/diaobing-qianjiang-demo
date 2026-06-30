import type { BoardUnit, DeploymentSlot as Slot, DragPayload } from '../types/game'
import { DeploymentSlot } from './DeploymentSlot'

interface DeploymentZoneProps {
  title: string
  zone: Slot['zone']
  slots: Slot[]
  units: Record<string, BoardUnit>
  unlockableSlotIds: Set<string>
  invalidDropTargetId?: string
  showDps: boolean
  selectedUnitId?: string
  buffedUnitIds: Set<string>
  onDragStart: (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => void
  onSlotClick: (slotId: string) => void
}

export function DeploymentZone({
  title,
  zone,
  slots,
  units,
  unlockableSlotIds,
  invalidDropTargetId,
  showDps,
  selectedUnitId,
  buffedUnitIds,
  onDragStart,
  onSlotClick,
}: DeploymentZoneProps) {
  const unlocked = slots.filter((slot) => slot.unlocked).length
  const locked = slots.length - unlocked
  return (
    <section className={`deployment-zone deployment-block-${zone}`} data-testid={`${zone}-deployment-block`}>
      <div className="zone-label">
        <span>{title}</span>
        <strong>
          {unlocked}/{locked}
        </strong>
      </div>
      <div className={`slot-grid ${zone === 'center' ? 'slot-grid-center' : ''}`}>
        {slots.map((slot) => (
          <DeploymentSlot
            key={slot.id}
            slot={slot}
            unit={slot.occupantId ? units[slot.occupantId] : undefined}
            isUnlockable={unlockableSlotIds.has(slot.id)}
            isInvalid={invalidDropTargetId === slot.id}
            showDps={showDps}
            isSelected={Boolean(slot.occupantId && slot.occupantId === selectedUnitId)}
            isBuffed={Boolean(slot.occupantId && buffedUnitIds.has(slot.occupantId))}
            isDraggable
            onDragStart={onDragStart}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </section>
  )
}
