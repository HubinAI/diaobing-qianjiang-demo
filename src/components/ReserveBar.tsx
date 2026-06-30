import { gameConfig, generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'
import type { DragPayload, ReserveItem } from '../types/game'

interface ReserveBarProps {
  items: ReserveItem[]
  onDragStart: (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => void
  onShovelClick: (itemId: string) => void
}

function renderItem(item: ReserveItem) {
  if (item.type === 'troop') {
    return {
      icon: troopConfig[item.troopType].icon,
      label: troopConfig[item.troopType].label,
      className: troopConfig[item.troopType].colorClass,
      sub: '★'.repeat(item.star),
      compactIdentity: true,
    }
  }
  if (item.type === 'general') {
    return {
      icon: generalConfig[item.generalId].label,
      label: generalConfig[item.generalId].label,
      className: `${generalConfig[item.generalId].colorClass} portrait-${item.generalId}`,
      sub: '名将牌',
      compactIdentity: true,
    }
  }
  if (item.type === 'weapon') {
    return {
      icon: weaponConfig[item.weaponId].icon,
      label: weaponConfig[item.weaponId].label,
      className: weaponConfig[item.weaponId].colorClass,
      sub: '专属武器',
      compactIdentity: false,
    }
  }
  return { icon: '锹', label: '铁锹', className: 'unit-shovel', sub: '解锁', compactIdentity: false }
}

export function ReserveBar({ items, onDragStart, onShovelClick }: ReserveBarProps) {
  return (
    <section className="reserve-section">
      <div className="reserve-label">
        <span>本轮补兵</span>
        <strong>
          {items.length}/{gameConfig.reserveCapacity}
        </strong>
      </div>
      <div className="reserve-grid">
        {Array.from({ length: gameConfig.reserveCapacity }, (_, index) => {
          const item = items[index]
          const view = item ? renderItem(item) : undefined
          return (
            <div
              key={index}
              className="reserve-slot"
              data-drop-kind="reserve"
              data-reserve-index={index}
              data-testid={`recruit-slot-${index}`}
              data-item-id={item?.id ?? ''}
              data-item-type={item?.type ?? ''}
            >
              {view ? (
                <div
                  className={`reserve-item is-draggable ${view.className}`}
                  onPointerDown={(event) => onDragStart({ source: 'reserve', itemId: item.id }, event)}
                  onClick={() => {
                    if (item.type === 'shovel') onShovelClick(item.id)
                  }}
                >
                  <strong>{view.icon}</strong>
                  {!view.compactIdentity && <span>{view.label}</span>}
                  <small>{view.sub}</small>
                </div>
              ) : (
                <span className="empty-reserve">+</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
