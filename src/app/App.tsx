import { useEffect, useReducer, useRef } from 'react'
import { GameShell } from '../components/GameShell'
import { duelReducer, type GameAction } from '../game/commandBus'
import { createInitialDuelState } from '../state/gameStore'
import type { EnemyType, EntrySide, ReserveItem, SideId, Star, TroopType } from '../types/game'

export function App() {
  const [state, dispatch] = useReducer(duelReducer, undefined, () => createInitialDuelState())
  const frameRef = useRef<number>()
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let lastTime = performance.now()

    const loop = (now: number) => {
      if (document.hidden) {
        lastTime = now
        frameRef.current = requestAnimationFrame(loop)
        return
      }
      const delta = Math.min(0.12, (now - lastTime) / 1000)
      lastTime = now
      dispatch({ type: 'tick', delta })
      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    const debugDispatch = (action: GameAction) => {
      const nextState = duelReducer(stateRef.current, action)
      stateRef.current = nextState
      dispatch({ type: 'hydrate', state: nextState })
    }

    window.__gameDebug = {
      getState: () => stateRef.current,
      reset: (seed?: string) => debugDispatch({ type: 'restart', seed }),
      advanceTime: (seconds: number) => debugDispatch({ type: 'advanceTime', seconds }),
      spawnEnemy: (sideId: SideId = 'player', entrySide: EntrySide = 'left', enemyType: EnemyType = 'normal', progress = 0) =>
        debugDispatch({ type: 'spawnEnemy', sideId, entrySide, enemyType, progress }),
      spawnWave: (index: number) => debugDispatch({ type: 'spawnWave', waveIndex: index }),
      setCoins: (coins: number) => debugDispatch({ type: 'setCoins', coins }),
      setSideCoins: (sideId: SideId, coins: number) => debugDispatch({ type: 'setSideCoins', sideId, coins }),
      recruitBatch: (confirmed = false) => debugDispatch({ type: 'recruit', confirmed }),
      createTroop: (troopType: TroopType = 'blade', star: Star = 1) =>
        debugDispatch({ type: 'debugAddTroop', troopType, star }),
      setReserveItems: (items: ReserveItem[]) => debugDispatch({ type: 'setReserveItems', items }),
      unlockAllSlots: () => debugDispatch({ type: 'unlockAllSlots' }),
      setGameSpeed: (speed: number) => debugDispatch({ type: 'setSpeed', speed }),
      setGuardianHp: (sideId: SideId, hp: number) => debugDispatch({ type: 'setGuardianHp', sideId, hp }),
      setEnemyHp: (sideId: SideId, enemyId: string, hp: number) => debugDispatch({ type: 'setEnemyHp', sideId, enemyId, hp }),
      pause: () => debugDispatch({ type: 'pause' }),
      resume: () => debugDispatch({ type: 'resume' }),
    }

    return () => {
      delete window.__gameDebug
    }
  }, [])

  useEffect(() => {
    const record = () => dispatch({ type: 'recordRuntimeError' })
    window.addEventListener('error', record)
    window.addEventListener('unhandledrejection', record)
    return () => {
      window.removeEventListener('error', record)
      window.removeEventListener('unhandledrejection', record)
    }
  }, [])

  return <GameShell state={state} dispatch={dispatch} />
}
