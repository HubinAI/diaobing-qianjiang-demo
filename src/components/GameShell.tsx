import { useCallback, useEffect, useMemo, useState } from 'react'
import { generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'
import type { GameAction } from '../game/commandBus'
import type { BoardUnit, DragPayload, DropTarget, DuelGameState, ReserveItem, SideId } from '../types/game'
import { AudioManager } from './AudioManager'
import { Battlefield } from './Battlefield'
import { CompendiumModal } from './CompendiumModal'
import { DebugPanel } from './DebugPanel'
import { GuardianGate } from './GuardianGate'
import { RecruitButton } from './RecruitButton'
import { ReserveBar } from './ReserveBar'
import { ResultModal } from './ResultModal'
import { ShovelStatus } from './ShovelStatus'
import { TopHud } from './TopHud'

interface GameShellProps {
  state: DuelGameState
  dispatch: React.Dispatch<GameAction>
}

export function GameShell({ state, dispatch }: GameShellProps) {
  const [drag, setDrag] = useState<{
    payload: DragPayload
    x: number
    y: number
    label: string
    icon: string
    className: string
  }>()

  const units: Record<string, BoardUnit> = useMemo(() => ({ ...state.player.troops, ...state.player.generals }), [state.player.generals, state.player.troops])

  const reserveById = useMemo(() => {
    return Object.fromEntries(state.player.reserveItems.map((item) => [item.id, item])) as Record<string, ReserveItem>
  }, [state.player.reserveItems])

  const getDragView = useCallback(
    (payload: DragPayload) => {
      if (payload.source === 'slot') {
        const unit = units[payload.unitId]
        if (!unit) return undefined
        if (unit.kind === 'troop') {
          const config = troopConfig[unit.troopType]
          return { label: config.label, icon: config.icon, className: config.colorClass }
        }
        const config = generalConfig[unit.generalId]
        return { label: config.label, icon: config.icon, className: config.colorClass }
      }

      const item = reserveById[payload.itemId]
      if (!item) return undefined
      if (item.type === 'troop') {
        const config = troopConfig[item.troopType]
        return { label: config.label, icon: config.icon, className: config.colorClass }
      }
      if (item.type === 'general') {
        const config = generalConfig[item.generalId]
        return { label: config.label, icon: config.icon, className: config.colorClass }
      }
      if (item.type === 'weapon') {
        const config = weaponConfig[item.weaponId]
        return { label: config.label, icon: config.icon, className: config.colorClass }
      }
      return { label: '铁锹', icon: '锹', className: 'unit-shovel' }
    },
    [reserveById, units],
  )

  const handleDragStart = useCallback(
    (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => {
      const view = getDragView(payload)
      if (!view) return
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      dispatch({ type: 'clearSelection' })
      setDrag({ payload, x: event.clientX, y: event.clientY, ...view })
    },
    [dispatch, getDragView],
  )

  useEffect(() => {
    if (!drag) return

    const getTarget = (x: number, y: number): DropTarget | undefined => {
      const element = document.elementFromPoint(x, y)
      const target = element?.closest<HTMLElement>('[data-drop-kind]')
      if (!target) return undefined
      if (target.dataset.dropKind === 'slot' && target.dataset.slotId) {
        return { type: 'slot', slotId: target.dataset.slotId }
      }
      if (target.dataset.dropKind === 'reserve' && target.dataset.reserveIndex) {
        return { type: 'reserve', index: Number(target.dataset.reserveIndex) }
      }
      return undefined
    }

    const onPointerMove = (event: PointerEvent) => {
      setDrag((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current))
    }

    const onPointerUp = (event: PointerEvent) => {
      const target = getTarget(event.clientX, event.clientY)
      if (target) {
        dispatch({ type: 'drop', payload: drag.payload, target })
      }
      setDrag(undefined)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    window.addEventListener('pointercancel', onPointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [dispatch, drag])

  return (
    <div className="game-page" data-testid="game-root">
      <div className="phone-frame">
        <TopHud state={state} />
        <Battlefield
          state={state}
          isDragging={Boolean(drag)}
          onDragStart={handleDragStart}
          onSlotClick={(sideId: SideId, slotId) => dispatch({ type: 'selectSlot', sideId, slotId })}
          onClearSelection={() => dispatch({ type: 'clearSelection' })}
        />
        <GuardianGate state={state} />
        <ReserveBar
          items={state.player.reserveItems}
          onDragStart={handleDragStart}
          onShovelClick={(itemId) => dispatch({ type: 'selectReserveShovel', itemId })}
        />
        <footer className="bottom-actions">
          <ShovelStatus state={state.player} onSelect={() => dispatch({ type: 'selectAutoShovel' })} />
          <RecruitButton state={state.player} onRecruit={() => dispatch({ type: 'recruit' })} />
          <button className="compendium-button" type="button" onClick={() => dispatch({ type: 'toggleCompendium' })}>
            图鉴
          </button>
          <AudioManager state={state.player} />
        </footer>
        <DebugPanel state={state} dispatch={dispatch} onToggle={() => dispatch({ type: 'toggleDebug' })} />
        {state.phase === 'idle' && (
          <div className="start-overlay">
            <button data-testid="start-game" className="start-game-button" type="button" onClick={() => dispatch({ type: 'start' })}>
              开始竞速
            </button>
          </div>
        )}
        {state.pendingRecruitConfirmationSide === 'player' && (
          <div className="modal-backdrop compact-modal" role="dialog" aria-modal="true">
            <section className="modal-panel confirm-panel">
              <h2>确认刷新？</h2>
              <p>仍有稀有内容未使用，确认刷新并替换？</p>
              <div className="confirm-actions">
                <button data-testid="cancel-recruit-overwrite" type="button" onClick={() => dispatch({ type: 'cancelRecruitOverwrite' })}>
                  取消
                </button>
                <button data-testid="confirm-recruit-overwrite" type="button" onClick={() => dispatch({ type: 'confirmRecruitOverwrite' })}>
                  确认刷新
                </button>
              </div>
            </section>
          </div>
        )}
        {state.toast && <div className="toast-message">{state.toast}</div>}
        {state.lastEffect && state.elapsedSeconds - state.lastEffect.at < 0.65 && (
          <div className="effect-pop" key={state.lastEffect.id}>
            {state.lastEffect.text}
          </div>
        )}
        {drag && (
          <div className={`drag-preview ${drag.className}`} style={{ left: drag.x, top: drag.y }}>
            <strong>{drag.icon}</strong>
            {drag.label !== drag.icon && <span>{drag.label}</span>}
          </div>
        )}
      </div>
      <CompendiumModal open={state.showCompendium} onClose={() => dispatch({ type: 'toggleCompendium' })} />
      <ResultModal state={state} onRestart={() => dispatch({ type: 'restart' })} />
    </div>
  )
}
