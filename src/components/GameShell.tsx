import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'
import type { GameAction } from '../game/commandBus'
import type { BoardUnit, DragPayload, DropTarget, DuelGameState, ReserveItem, SideId } from '../types/game'
import { AudioManager } from './AudioManager'
import { Battlefield } from './Battlefield'
import { CompendiumModal } from './CompendiumModal'
import { DebugPanel } from './DebugPanel'
import { GuardianGate } from './GuardianGate'
import { MatchmakingOverlay } from './MatchmakingOverlay'
import { RecruitButton } from './RecruitButton'
import { ReserveBar } from './ReserveBar'
import { ResultModal } from './ResultModal'
import { ShovelStatus } from './ShovelStatus'
import { TopHud } from './TopHud'

interface TutorialStep {
  id: number
  title: string
  targetRef: React.RefObject<HTMLElement | null>
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

  const [tutorialStep, setTutorialStep] = useState(-1)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [matchmaking, setMatchmaking] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const prevPhaseRef = useRef(state.phase)
  const recruitBtnRef = useRef<HTMLButtonElement>(null)
  const reserveRef = useRef<HTMLDivElement>(null)
  const battlefieldRef = useRef<HTMLDivElement>(null)
  const phoneFrameRef = useRef<HTMLDivElement>(null)

  // 精简为 3 步：补兵 → 部署 → 保护貂蝉
  const tutorialSteps: TutorialStep[] = useMemo(() => [
    { id: 1, title: '点击补兵招募单位', targetRef: recruitBtnRef },
    { id: 2, title: '拖拽单位到战场槽位部署', targetRef: battlefieldRef },
    { id: 3, title: '击杀敌人 · 保护貂蝉 · 击败对手', targetRef: reserveRef },
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

  // 自动推进：识别玩家正确操作后立即切换
  const prevReserveLenRef = useRef(0)
  const prevDeployCountRef = useRef(0)
  const prevKillCountRef = useRef(0)

  useEffect(() => {
    if (tutorialDone || tutorialStep < 0) return

    // 第1步 → 第2步：补兵后 reserveItems 数量增加
    if (tutorialStep === 0) {
      const currentLen = state.player.reserveItems.length
      if (currentLen > prevReserveLenRef.current && currentLen > 0) {
        setTutorialStep(1)
      }
      prevReserveLenRef.current = currentLen
      return
    }

    // 第2步 → 第3步：部署了一个单位
    if (tutorialStep === 1) {
      const currentDeploy = state.player.metrics.deployCount
      if (currentDeploy > prevDeployCountRef.current) {
        setTutorialStep(2)
      }
      prevDeployCountRef.current = currentDeploy
      return
    }

    // 第3步完成：首次击杀敌人
    if (tutorialStep === 2) {
      const currentKills = state.player.metrics.totalKills
      if (currentKills > prevKillCountRef.current) {
        const t = setTimeout(() => setTutorialDone(true), 1500)
        return () => clearTimeout(t)
      }
      prevKillCountRef.current = currentKills
    }
  }, [tutorialDone, tutorialStep, state.player.reserveItems.length, state.player.metrics.deployCount, state.player.metrics.totalKills])

  const skipTutorial = useCallback(() => setTutorialDone(true), [])

  // 计算高亮框位置 - 仅在步骤变化时计算，不用 RAF
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({ display: 'none' })
  useEffect(() => {
    if (tutorialDone || !currentStep || !phoneFrameRef.current) {
      setHighlightStyle({ display: 'none' })
      return
    }
    const el = currentStep.targetRef.current
    const frame = phoneFrameRef.current
    if (!el) {
      setHighlightStyle({ display: 'none' })
      return
    }
    const rect = el.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      setHighlightStyle({ display: 'none' })
      return
    }
    setHighlightStyle({
      display: 'block',
      left: rect.left - frameRect.left - 3,
      top: rect.top - frameRect.top - 3,
      width: rect.width + 6,
      height: rect.height + 6,
    })
  }, [tutorialDone, currentStep])

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
        <TopHud state={state} />
        <div ref={battlefieldRef} className="battlefield">
          <Battlefield
            state={state}
            isDragging={Boolean(drag)}
            onDragStart={handleDragStart}
            onSlotClick={(sideId: SideId, slotId) => dispatch({ type: 'selectSlot', sideId, slotId })}
            onClearSelection={() => dispatch({ type: 'clearSelection' })}
          />
        </div>
        <GuardianGate state={state} />
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
        {state.phase === 'idle' && !matchmaking && !restartRequested && (
          <div className="start-overlay">
            <div className="start-intro">
              <h1>调兵遣将</h1>
              <p>招募士兵 · 部署防线 · 保护貂蝉 · 击败对手</p>
            </div>
            <button data-testid="start-game" className="start-game-button" type="button" onClick={() => setMatchmaking(true)}>
              开始竞速
            </button>
          </div>
        )}
        {/* restart 后的自动匹配：检测到 restartRequested + idle 状态即触发 */}
        {restartRequested && state.phase === 'idle' && (
          <MatchmakingOverlay
            targetDifficulty={state.ghostDifficulty}
            onComplete={() => {
              setRestartRequested(false)
              setMatchmaking(false)
              dispatch({ type: 'start' })
            }}
          />
        )}
        {matchmaking && (
          <MatchmakingOverlay
            targetDifficulty={state.ghostDifficulty}
            onComplete={() => {
              setMatchmaking(false)
              dispatch({ type: 'start' })
            }}
          />
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
        {/* 脉冲高亮框 - 仅在教程激活时渲染 */}
        {!tutorialDone && currentStep && (
          <div className="tutorial-highlight" style={highlightStyle} />
        )}
        {/* 顶部提示条 - 轻量，不占布局空间 */}
        {!tutorialDone && currentStep && (
          <div className="tutorial-toast">
            <span className="tutorial-toast-step">{currentStep.id}/{tutorialSteps.length}</span>
            <span>{currentStep.title}</span>
            <button className="tutorial-toast-skip" type="button" onClick={skipTutorial}>跳过</button>
          </div>
        )}
      </div>
      <CompendiumModal open={state.showCompendium} onClose={() => dispatch({ type: 'toggleCompendium' })} />
      <ResultModal
        state={state}
        onRestart={() => {
          dispatch({ type: 'restart' })
          setRestartRequested(true)
        }}
      />
    </div>
  )
}
