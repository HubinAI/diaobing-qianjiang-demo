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
  target: string            // CSS selector for the element to highlight
  title: string
  description: string
  requireAction: boolean    // whether the player must perform an action to advance
  advanceCondition?: () => boolean
  position: 'top' | 'bottom' | 'left' | 'right'
}

interface GameShellProps {
  state: DuelGameState
  dispatch: React.Dispatch<GameAction>
}

// 引导步骤定义
function buildTutorialSteps(state: DuelGameState): TutorialStep[] {
  return [
    {
      id: 1,
      target: '.recruit-button',
      title: '招募士兵',
      description: '点击这里消耗银币招募 6 个单位。每次招募会随机产出刀兵、枪兵、弓兵，运气好还会出现武将或专属武器。',
      requireAction: true,
      advanceCondition: () => state.player.reserveItems.length > 0,
      position: 'top',
    },
    {
      id: 2,
      target: '.reserve-section',
      title: '预备栏',
      description: '招募到的单位会出现在这里。拖拽单位到战场上的绿色槽位即可部署。两个相同兵种、相同星级的单位可以合成升级。',
      requireAction: true,
      advanceCondition: () => state.player.metrics.deployCount > 0,
      position: 'top',
    },
    {
      id: 3,
      target: '.duel-battlefield',
      title: '部署到战场',
      description: '将单位拖到战场槽位上。不同兵种有不同的攻击范围和伤害模式：刀兵范围攻击、枪兵贯穿伤害、弓兵远程单体。部署位置决定防守效果。',
      requireAction: true,
      advanceCondition: () => Object.keys(state.player.troops).length >= 2,
      position: 'bottom',
    },
    {
      id: 4,
      target: '.guardian-gate',
      title: '保护貂蝉',
      description: '敌人会沿路径前进，碰到貂蝉会扣血。HP 归零就输了。你的单位会自动攻击路径上的敌人。击杀敌人获得金币，用于下一轮招募。',
      requireAction: false,
      position: 'top',
    },
    {
      id: 5,
      target: '.lead-pill',
      title: '与对手竞速',
      description: '你和对手各自防守，谁先守住全部 8 波谁赢。顶部显示双方 HP 对比和领先状态。合理分配资源、抓住武将时机是取胜关键。准备好了吗？开始你的第一战！',
      requireAction: false,
      position: 'bottom',
    },
  ]
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

  // 新手引导状态
  const [tutorialActive, setTutorialActive] = useState(true)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const [tutorialDismissed, setTutorialDismissed] = useState(false)
  const prevPhaseRef = useRef(state.phase)
  const tutorialSteps = useMemo(() => buildTutorialSteps(state), [state])
  const currentStep = tutorialSteps[tutorialStepIndex]

  // 引导在"开始竞速"后启动，游戏结束后重置
  useEffect(() => {
    if (prevPhaseRef.current === 'idle' && state.phase === 'playing') {
      setTutorialActive(true)
      setTutorialStepIndex(0)
      setTutorialDismissed(false)
    }
    if (state.phase === 'won' || state.phase === 'lost' || state.phase === 'draw') {
      setTutorialActive(false)
      setTutorialDismissed(true)
    }
    prevPhaseRef.current = state.phase
  }, [state.phase])

  // 自动推进引导步骤
  useEffect(() => {
    if (!tutorialActive || !currentStep || tutorialDismissed) return
    if (currentStep.advanceCondition && currentStep.advanceCondition()) {
      if (tutorialStepIndex < tutorialSteps.length - 1) {
        const timer = setTimeout(() => setTutorialStepIndex((i) => i + 1), 400)
        return () => clearTimeout(timer)
      } else {
        const timer = setTimeout(() => setTutorialActive(false), 1500)
        return () => clearTimeout(timer)
      }
    }
    // 非强制步骤 2 秒后自动推进
    if (!currentStep.requireAction && !currentStep.advanceCondition) {
      const timer = setTimeout(() => {
        if (tutorialStepIndex < tutorialSteps.length - 1) {
          setTutorialStepIndex((i) => i + 1)
        } else {
          setTutorialActive(false)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [tutorialActive, currentStep, tutorialStepIndex, tutorialSteps.length, tutorialDismissed, state.player.reserveItems, state.player.metrics.deployCount, Object.keys(state.player.troops).length])

  const skipTutorial = useCallback(() => {
    setTutorialActive(false)
    setTutorialDismissed(true)
  }, [])

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
        {/* 新手引导遮罩 */}
        {tutorialActive && currentStep && !tutorialDismissed && (
          <div className="tutorial-overlay">
            <div className="tutorial-backdrop" />
            <div className={`tutorial-tooltip tutorial-${currentStep.position}`}>
              <div className="tutorial-step-badge">第 {currentStep.id} / {tutorialSteps.length} 步</div>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.description}</p>
              <div className="tutorial-actions">
                {currentStep.requireAction && (
                  <span className="tutorial-hint">按提示操作以继续</span>
                )}
                <button className="tutorial-skip" type="button" onClick={skipTutorial}>
                  跳过教程
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
