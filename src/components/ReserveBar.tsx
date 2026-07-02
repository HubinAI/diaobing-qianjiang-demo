import { useEffect, useRef, useState } from 'react'
import { gameConfig, generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'
import type { DragPayload, ReserveItem } from '../types/game'

interface ReserveBarProps {
  items: ReserveItem[]
  coins: number
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

export function ReserveBar({ items, coins, onDragStart, onShovelClick }: ReserveBarProps) {
  const prevCoinsRef = useRef(coins)
  const [coinPop, setCoinPop] = useState<{ amount: number; key: number } | null>(null)

  useEffect(() => {
    const delta = coins - prevCoinsRef.current
    if (delta > 0 && delta < 5) {
      // 只显示小额增量（排除击杀奖励等大额变化）
      setCoinPop({ amount: Math.floor(delta), key: Date.now() })
      const timer = setTimeout(() => setCoinPop(null), 800)
      return () => clearTimeout(timer)
    }
    prevCoinsRef.current = coins
  }, [coins])

  return (
    <section className="reserve-section">
      <div className="reserve-label">
        <span>本轮补兵</span>
        <span className="reserve-coins">
          <i className="coin-icon" aria-hidden="true">◈</i>
          <strong>{Math.floor(coins)}</strong>
          {coinPop && (
            <span className="coin-pop" key={coinPop.key}>
              +{coinPop.amount}
            </span>
          )}
        </span>
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
