import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface TutorialStep {
  id: number
  title: string
  description: string
  /** 用 ref 直接定位高亮区域，不依赖 CSS selector */
  highlightRect?: () => DOMRect | null
}

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

  const [tutorialStep, setTutorialStep] = useState(-1) // -1 = waiting to start
  const [tutorialDone, setTutorialDone] = useState(false)
  const prevPhaseRef = useRef(state.phase)
  const recruitBtnRef = useRef<HTMLButtonElement>(null)
  const reserveRef = useRef<HTMLDivElement>(null)
  const battlefieldRef = useRef<HTMLDivElement>(null)
  const guardianRef = useRef<HTMLDivElement>(null)
  const leadPillRef = useRef<HTMLDivElement>(null)
  const phoneFrameRef = useRef<HTMLDivElement>(null)

  const tutorialSteps: TutorialStep[] = useMemo(() => [
    {
      id: 1,
      title: '招募士兵',
      description: '点击补兵按钮，消耗银币随机获取 6 个单位',
      highlightRect: () => recruitBtnRef.current?.getBoundingClientRect() ?? null,
    },
    {
      id: 2,
      title: '预备栏',
      description: '招募到的单位出现在这里，拖到下方战场槽位部署',
      highlightRect: () => reserveRef.current?.getBoundingClientRect() ?? null,
    },
    {
      id: 3,
      title: '部署防线',
      description: '将单位拖到绿色槽位。刀兵范围攻击、枪兵贯穿、弓兵远程',
      highlightRect: () => battlefieldRef.current?.getBoundingClientRect() ?? null,
    },
    {
      id: 4,
      title: '保护貂蝉',
      description: '敌人沿路径进攻，碰到貂蝉扣血。HP 归零则败',
      highlightRect: () => guardianRef.current?.getBoundingClientRect() ?? null,
    },
    {
      id: 5,
      title: '击败对手',
      description: '比对手先守住全部波次即获胜。祝你好运！',
      highlightRect: () => leadPillRef.current?.getBoundingClientRect() ?? null,
    },
  ], [])

  const currentStep = tutorialSteps[tutorialStep]

  // 教程生命周期
  useEffect(() => {
    if (prevPhaseRef.current === 'idle' && state.phase === 'playing') {
      setTutorialStep(0)
      setTutorialDone(false)
    }
    if (state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw') {
      setTutorialDone(true)
    }
    prevPhaseRef.current = state.phase
  }, [state.phase])

  // 自动推进
  useEffect(() => {
    if (tutorialDone || tutorialStep < 0) return
    if (tutorialStep === 0 && state.player.reserveItems.length > 0) {
      const t = setTimeout(() => setTutorialStep(1), 600)
      return () => clearTimeout(t)
    }
    if (tutorialStep === 1 && state.player.metrics.deployCount > 0) {
      const t = setTimeout(() => setTutorialStep(2), 600)
      return () => clearTimeout(t)
    }
    if (tutorialStep === 2 && Object.keys(state.player.troops).length >= 2) {
      const t = setTimeout(() => setTutorialStep(3), 600)
      return () => clearTimeout(t)
    }
    if (tutorialStep === 3 && state.player.waveIndex >= 2) {
      const t = setTimeout(() => setTutorialStep(4), 600)
      return () => clearTimeout(t)
    }
    if (tutorialStep === 4 && state.elapsedSeconds > 8) {
      const t = setTimeout(() => setTutorialDone(true), 3500)
      return () => clearTimeout(t)
    }
  }, [tutorialDone, tutorialStep, state.player.reserveItems.length, state.player.metrics.deployCount, Object.keys(state.player.troops).length, state.player.waveIndex, state.elapsedSeconds])

  const nextTutorial = useCallback(() => {
    if (tutorialStep < tutorialSteps.length - 1) {
      setTutorialStep((s) => s + 1)
    } else {
      setTutorialDone(true)
    }
  }, [tutorialStep, tutorialSteps.length])

  const skipTutorial = useCallback(() => setTutorialDone(true), [])

  // 计算高亮框相对于 phone-frame 的位置
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({ display: 'none' })
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({ display: 'none' })
  const rafRef = useRef<number>()

  useEffect(() => {
    if (tutorialDone || !currentStep?.highlightRect || !phoneFrameRef.current) {
      setHighlightStyle({ display: 'none' })
      setArrowStyle({ display: 'none' })
      return
    }
    const update = () => {
      const rect = currentStep.highlightRect!()
      const frameRect = phoneFrameRef.current!.getBoundingClientRect()
      if (!rect || rect.width === 0) {
        setHighlightStyle({ display: 'none' })
        setArrowStyle({ display: 'none' })
        return
      }
      setHighlightStyle({
        display: 'block',
        left: rect.left - frameRect.left - 3,
        top: rect.top - frameRect.top - 3,
        width: rect.width + 6,
        height: rect.height + 6,
      })
      // 箭头指向高亮框顶部中央
      setArrowStyle({
        display: 'block',
        left: rect.left - frameRect.left + rect.width / 2,
        top: rect.top - frameRect.top - 8,
      })
    }
    update()
    const onFrame = () => {
      update()
      rafRef.current = requestAnimationFrame(onFrame)
    }
    rafRef.current = requestAnimationFrame(onFrame)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tutorialDone, currentStep, state.phase])

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
      if (target) dispatch({ type: 'drop', payload: drag.payload, target })
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
      <div className="phone-frame" ref={phoneFrameRef}>
        <TopHud state={state} leadPillRef={leadPillRef} />
        <div ref={battlefieldRef}>
          <Battlefield
            state={state}
            isDragging={Boolean(drag)}
            onDragStart={handleDragStart}
            onSlotClick={(sideId: SideId, slotId) => dispatch({ type: 'selectSlot', sideId, slotId })}
            onClearSelection={() => dispatch({ type: 'clearSelection' })}
          />
        </div>
        <div ref={guardianRef}>
          <GuardianGate state={state} />
        </div>
        <div ref={reserveRef}>
          <ReserveBar
            items={state.player.reserveItems}
            onDragStart={handleDragStart}
            onShovelClick={(itemId) => dispatch({ type: 'selectReserveShovel', itemId })}
          />
        </div>
        <footer className="bottom-actions">
          <ShovelStatus state={state.player} onSelect={() => dispatch({ type: 'selectAutoShovel' })} />
          <RecruitButton state={state.player} onRecruit={() => dispatch({ type: 'recruit' })} ref={recruitBtnRef} />
          <button className="compendium-button" type="button" onClick={() => dispatch({ type: 'toggleCompendium' })}>
            图鉴
          </button>
          <AudioManager state={state.player} />
        </footer>
        <DebugPanel state={state} dispatch={dispatch} onToggle={() => dispatch({ type: 'toggleDebug' })} />
        {state.phase === 'idle' && (
          <div className="start-overlay">
            <div className="start-intro">
              <h1>调兵遣将</h1>
              <p>招募士兵 · 部署防线 · 保护貂蝉 · 击败对手</p>
            </div>
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
        {/* 脉冲高亮框 */}
        <div className="tutorial-highlight" style={highlightStyle} />
        {/* 指向箭头 */}
        <div className="tutorial-pointer" style={arrowStyle} />
        {/* 底部提示卡片 */}
        {!tutorialDone && currentStep && (
          <div className="tutorial-bar">
            <div className="tutorial-bar-inner">
              <div className="tutorial-bar-content">
                <span className="tutorial-bar-step">{currentStep.id}/{tutorialSteps.length}</span>
                <div className="tutorial-bar-text">
                  <strong>{currentStep.title}</strong>
                  <span>{currentStep.description}</span>
                </div>
              </div>
              <div className="tutorial-bar-actions">
                {currentStep.id < tutorialSteps.length && (
                  <button className="tutorial-bar-next" type="button" onClick={nextTutorial}>
                    知道了
                  </button>
                )}
                <button className="tutorial-bar-skip" type="button" onClick={skipTutorial}>
                  跳过
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <CompendiumModal open={state.showCompendium} onClose={() => dispatch({ type: 'toggleCompendium' })} />
      <ResultModal state={state} onRestart={() => dispatch({ type: 'restart' })} />
    </div>
  )
}
