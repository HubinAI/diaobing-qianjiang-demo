import { describe, expect, it } from 'vitest'
import { executeGameCommand, duelReducer } from './commandBus'
import { createInitialGameState, createInitialDuelState } from '../state/gameStore'
import { createInitialSlots } from './engine'
import { enemyPaths, pathIdFor, samplePath } from './paths'
import { getCompatibleGhostFiles } from '../ghost/ghostRepository'
import { validateGhostRunFile } from '../ghost/ghostValidator'

function advanceDuel(seconds: number) {
  const state = createInitialDuelState('duel-seed-001', 'playing')
  return duelReducer({
    ...state,
    player: { ...state.player, guardianHp: 10000 },
    ghost: { ...state.ghost, guardianHp: 10000 },
  }, { type: 'advanceTime', seconds })
}

describe('round 5 ghost duel core', () => {
  it('builds vertically mirrored paths and deployment slots', () => {
    expect(pathIdFor('player', 'left')).toBe('player-left')
    expect(pathIdFor('ghost', 'left')).toBe('ghost-left')

    for (const entrySide of ['left', 'right'] as const) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const player = samplePath(pathIdFor('player', entrySide), progress)
        const ghost = samplePath(pathIdFor('ghost', entrySide), progress)
        expect(ghost.x).toBeCloseTo(player.x)
        expect(ghost.y).toBeCloseTo(1 - player.y)
      }
    }

    const playerSlots = createInitialSlots('player')
    const ghostSlots = createInitialSlots('ghost')
    expect(playerSlots).toHaveLength(14)
    expect(ghostSlots).toHaveLength(14)
    playerSlots.forEach((slot, index) => {
      expect(ghostSlots[index].x).toBeCloseTo(slot.x)
      expect(ghostSlots[index].y).toBeCloseTo(1 - slot.y)
      expect(ghostSlots[index].unlocked).toBe(slot.unlocked)
    })
  })

  it('keeps side recruit batches deterministic with the same seed', () => {
    let player = createInitialGameState('same-seed', 'playing', 'player')
    let ghost = createInitialGameState('same-seed', 'playing', 'ghost')
    player = { ...player, coins: 10000 }
    ghost = { ...ghost, coins: 10000 }

    for (let index = 0; index < 30; index += 1) {
      player = duelReducer({ ...createInitialDuelState('same-seed', 'playing'), player }, { type: 'setSideCoins', sideId: 'player', coins: 10000 }).player
      ghost = duelReducer({ ...createInitialDuelState('same-seed', 'playing'), ghost }, { type: 'setSideCoins', sideId: 'ghost', coins: 10000 }).ghost
      const p = duelReducer({ ...createInitialDuelState('same-seed', 'playing'), player, ghost }, { type: 'recruit', confirmed: true }).player.reserveItems
      const commandResult = executeGameCommand({ ...createInitialDuelState('same-seed', 'playing'), player, ghost }, {
        sideId: 'ghost',
        source: 'ghost',
        type: 'recruit_batch',
        payload: { expectedBatchIndex: ghost.metrics.batchRecruitCount },
      })
      const g = commandResult.state!.ghost.reserveItems
      expect(g.map((item) => JSON.stringify({ ...item, id: '' }))).toEqual(p.map((item) => JSON.stringify({ ...item, id: '' })))
      player = duelReducer({ ...createInitialDuelState('same-seed', 'playing'), player, ghost }, { type: 'recruit', confirmed: true }).player
      ghost = commandResult.state!.ghost
    }
  })

  it('uses the same command bus for ghost recruit, deploy, merge and unlock', () => {
    let state = createInitialDuelState('duel-seed-001', 'playing')
    state = { ...state, ghost: { ...state.ghost, coins: 1000 } }

    let result = executeGameCommand(state, {
      sideId: 'ghost',
      source: 'ghost',
      type: 'recruit_batch',
      payload: { expectedBatchIndex: 0 },
    })
    expect(result.ok).toBe(true)
    state = result.state!

    result = executeGameCommand(state, {
      sideId: 'ghost',
      source: 'ghost',
      type: 'deploy',
      payload: {
        item: { batchIndex: 0, recruitSlotIndex: 1, expectedType: 'blade', expectedStar: 1 },
        targetSlotId: 'ghost-left-active-0',
      },
    })
    expect(result.ok).toBe(true)
    state = result.state!

    result = executeGameCommand(state, {
      sideId: 'ghost',
      source: 'ghost',
      type: 'deploy',
      payload: {
        item: { batchIndex: 0, recruitSlotIndex: 5, expectedType: 'blade', expectedStar: 1 },
        targetSlotId: 'ghost-left-active-1',
      },
    })
    expect(result.ok).toBe(true)
    state = result.state!

    result = executeGameCommand(state, {
      sideId: 'ghost',
      source: 'ghost',
      type: 'merge',
      payload: { fromSlotId: 'ghost-left-active-1', targetSlotId: 'ghost-left-active-0', expectedResultStar: 2 },
    })
    expect(result.ok).toBe(true)
    state = result.state!
    expect(Object.values(state.ghost.troops)[0].star).toBe(2)

    result = executeGameCommand(state, {
      sideId: 'ghost',
      source: 'ghost',
      type: 'unlock_slot',
      payload: { targetSlotId: 'ghost-right-locked-0' },
    })
    expect(result.ok).toBe(true)
    expect(result.state!.ghost.slots.find((slot) => slot.id === 'ghost-right-locked-0')?.unlocked).toBe(true)
  })

  it('ships compatible easy, normal and hard ghost event files that replay cleanly', () => {
    const files = getCompatibleGhostFiles()
    expect(files.map((file) => file.difficulty).sort()).toEqual(['easy', 'hard', 'normal'])

    for (const file of files) {
      expect(validateGhostRunFile(file)).toEqual([])
      expect(file.seed).toBe('duel-seed-001')
      expect(file.actions.length).toBeGreaterThan(0)
      file.actions.forEach((action, index) => {
        if (index > 0) expect(action.at).toBeGreaterThanOrEqual(file.actions[index - 1].at)
      })

      const initial = createInitialDuelState(file.seed, 'playing')
      const state = duelReducer({
        ...initial,
        ghostDifficulty: file.difficulty,
        ghostId: file.ghostId,
        ghostName: file.displayName,
        ghostReplay: {
          ...initial.ghostReplay,
          difficulty: file.difficulty,
          fileId: file.ghostId,
        },
        ghost: {
          ...initial.ghost,
          coins: 10000,
        },
      }, { type: 'advanceTime', seconds: file.actions[file.actions.length - 1].at + 0.3 })

      expect(state.ghostReplay.nextActionIndex).toBe(file.actions.length)
      expect(state.ghostReplay.failedActionCount).toBe(0)
      expect(state.metrics.ghostActionFailureCount).toBe(0)
    }
  })

  it('pauses ghost replay on simulated time and resumes with speed scaling', () => {
    let state = createInitialDuelState('duel-seed-001', 'playing')
    state = duelReducer(state, { type: 'advanceTime', seconds: 0.6 })
    expect(state.ghostReplay.nextActionIndex).toBe(1)

    state = duelReducer(state, { type: 'pause' })
    const pausedIndex = state.ghostReplay.nextActionIndex
    state = duelReducer(state, { type: 'advanceTime', seconds: 5 })
    expect(state.ghostReplay.nextActionIndex).toBe(pausedIndex)

    state = duelReducer(state, { type: 'resume' })
    state = duelReducer(state, { type: 'setSpeed', speed: 2 })
    state = duelReducer(state, { type: 'tick', delta: 0.5 })
    expect(state.elapsedSeconds).toBeGreaterThan(1.5)
    expect(state.ghostReplay.nextActionIndex).toBeGreaterThan(pausedIndex)
  })

  it('settles win, loss, draw and timeout without hidden rubber banding', () => {
    let state = createInitialDuelState('duel-seed-001', 'playing')
    state = { ...state, ghost: { ...state.ghost, guardianHp: 0 } }
    expect(duelReducer(state, { type: 'tick', delta: 0.01 }).phase).toBe('won')

    state = createInitialDuelState('duel-seed-001', 'playing')
    state = { ...state, player: { ...state.player, guardianHp: 0 } }
    expect(duelReducer(state, { type: 'tick', delta: 0.01 }).phase).toBe('lost')

    state = createInitialDuelState('duel-seed-001', 'playing')
    state = { ...state, player: { ...state.player, guardianHp: 0 }, ghost: { ...state.ghost, guardianHp: 0 } }
    expect(duelReducer(state, { type: 'tick', delta: 0.01 }).phase).toBe('draw')

    state = createInitialDuelState('duel-seed-001', 'playing')
    state = { ...state, elapsedSeconds: 300, player: { ...state.player, guardianHp: 80 }, ghost: { ...state.ghost, guardianHp: 70 } }
    expect(duelReducer(state, { type: 'tick', delta: 0.01 }).phase).toBe('won')
  })

  it('runs 180 simulated seconds with enemies, ghost replay, and no action failures', () => {
    const state = advanceDuel(180)
    expect(Object.keys(enemyPaths)).toEqual(['player-left', 'player-right', 'ghost-left', 'ghost-right'])
    expect(state.elapsedSeconds).toBeGreaterThan(179.9)
    expect(state.player.totalSpawned).toBeGreaterThan(20)
    expect(state.ghost.totalSpawned).toBeGreaterThan(20)
    expect(state.ghostReplay.failedActionCount).toBe(0)
    expect(state.metrics.ghostActionFailureCount).toBe(0)
    expect(state.player.guardianHp).toBeLessThan(10000)
    expect(state.ghost.guardianHp).toBeLessThan(10000)
  })
})
