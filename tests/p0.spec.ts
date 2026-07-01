import { expect, test, type Page } from '@playwright/test'
import type { DuelGameState, GameDebugApi } from '../src/types/game'

declare global {
  interface Window {
    __gameDebug?: GameDebugApi
  }
}

const consoleErrors = new WeakMap<Page, string[]>()

async function openDuel(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__gameDebug))
  await page.getByTestId('start-game').click()
}

async function debugState(page: Page): Promise<DuelGameState> {
  return page.evaluate(() => window.__gameDebug!.getState())
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await openDuel(page)
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? []).toEqual([])
})

test('renders mirrored duel battlefield with required ids', async ({ page }) => {
  await expect(page.getByTestId('duel-root')).toBeVisible()
  await expect(page.getByTestId('player-half')).toBeVisible()
  await expect(page.getByTestId('ghost-half')).toBeVisible()
  await expect(page.getByTestId('player-guardian-hp')).toContainText('%')
  await expect(page.getByTestId('ghost-guardian-hp')).toHaveCount(0)
  await expect(page.getByTestId('duel-time')).toContainText('对方貂蝉 100%')
  await expect(page.getByTestId('player-guardian-zone')).toBeVisible()
  await expect(page.getByTestId('player-guardian-zone')).not.toContainText('对方')
  await expect(page.getByTestId('player-guardian-crisis')).toHaveAttribute('data-value', '守稳')
  await expect(page.getByTestId('ghost-name')).toContainText('演武对手')
  await expect(page.getByTestId('ghost-difficulty')).toContainText('normal')
  await expect(page.getByTestId('lead-status')).toBeVisible()
  await expect(page.getByTestId('duel-phase')).toHaveAttribute('data-value', 'playing')

  const guardianRatio = await page.evaluate(() => {
    const field = document.querySelector<HTMLElement>('[data-testid="duel-root"]')!.getBoundingClientRect()
    const guardian = document.querySelector<HTMLElement>('[data-testid="player-guardian-zone"]')!.getBoundingClientRect()
    return guardian.height / (field.height + guardian.height)
  })
  expect(guardianRatio).toBeGreaterThanOrEqual(0.08)
  expect(guardianRatio).toBeLessThanOrEqual(0.12)

  await expect(page.locator('[data-side-id="player"]')).toHaveCount(22)
  await expect(page.locator('[data-side-id="ghost"]')).toHaveCount(22)
  await expect(page.getByTestId('path-player-left')).toBeVisible()
  await expect(page.getByTestId('path-player-right')).toBeVisible()
  await expect(page.getByTestId('path-ghost-left')).toBeVisible()
  await expect(page.getByTestId('path-ghost-right')).toBeVisible()

  const state = await debugState(page)
  expect(state.player.slots.filter((slot) => slot.zone === 'left')).toHaveLength(10)
  expect(state.player.slots.filter((slot) => slot.zone === 'center')).toHaveLength(2)
  expect(state.player.slots.filter((slot) => slot.zone === 'right')).toHaveLength(10)
  expect(state.player.slots.filter((slot) => slot.unlocked)).toHaveLength(13)
  expect(state.player.slots.filter((slot) => !slot.unlocked)).toHaveLength(9)
  state.player.slots.forEach((slot, index) => {
    const ghost = state.ghost.slots[index]
    expect(ghost.x).toBeCloseTo(slot.x)
    expect(ghost.y).toBeCloseTo(1 - slot.y)
    expect(ghost.adjacentRoadId).toBe(slot.adjacentRoadId.replace('player-', 'ghost-'))
  })

  const playerPathPoints = await page.evaluate(() => {
    const left = document.querySelector('[data-testid="path-player-left"]')?.getAttribute('points') ?? ''
    const right = document.querySelector('[data-testid="path-player-right"]')?.getAttribute('points') ?? ''
    return { left, right }
  })
  const leftPath = playerPathPoints.left.split(' ').map((pair) => pair.split(',').map(Number))
  const rightPath = playerPathPoints.right.split(' ').map((pair) => pair.split(',').map(Number))
  rightPath.forEach(([x, y], index) => {
    expect(x).toBeCloseTo(100 - leftPath[index][0])
    expect(y).toBeCloseTo(leftPath[index][1])
  })

  const minGap = await page.evaluate(() => {
    const slots = [...document.querySelectorAll<HTMLElement>('[data-side-id="player"]')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { id: element.dataset.slotId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: Math.max(rect.width, rect.height) }
      })
    let gap = Number.POSITIVE_INFINITY
    let pair = ''
    for (let outer = 0; outer < slots.length; outer += 1) {
      for (let inner = outer + 1; inner < slots.length; inner += 1) {
        const distance = Math.hypot(slots[outer].x - slots[inner].x, slots[outer].y - slots[inner].y)
        const currentGap = distance - (slots[outer].size + slots[inner].size) / 2
        if (currentGap < gap) {
          gap = currentGap
          pair = `${slots[outer].id}/${slots[inner].id}`
        }
      }
    }
    return { gap, pair }
  })
  expect(minGap.gap, minGap.pair).toBeGreaterThanOrEqual(0)

  const layoutRelation = await page.evaluate(() => {
    const field = document.querySelector<HTMLElement>('[data-testid="duel-root"]')!.getBoundingClientRect()
    const slots = [...document.querySelectorAll<HTMLElement>('[data-side-id="player"]')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          id: element.dataset.slotId!,
          zone: element.dataset.slotZone!,
          x: Number(element.dataset.slotX),
          y: Number(element.dataset.slotY),
          facingAngleDeg: Number(element.dataset.facingAngleDeg),
          leftEdge: rect.left - field.left,
          rightEdge: field.right - rect.right,
        }
      })
      .filter((slot) => slot.zone !== 'center')
    const paths = {
      left: (document.querySelector('[data-testid="path-player-left"]')?.getAttribute('points') ?? '').split(' ').map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x: x / 100, y: y / 100 }
      }),
      right: (document.querySelector('[data-testid="path-player-right"]')?.getAttribute('points') ?? '').split(' ').map((pair) => {
        const [x, y] = pair.split(',').map(Number)
        return { x: x / 100, y: y / 100 }
      }),
    }
    function closest(point: { x: number; y: number }, path: Array<{ x: number; y: number }>) {
      let best = { x: path[0].x, y: path[0].y, distance: Number.POSITIVE_INFINITY }
      for (let index = 0; index < path.length - 1; index += 1) {
        const start = path[index]
        const end = path[index + 1]
        const vx = end.x - start.x
        const vy = (end.y - start.y) * 1.26
        const wx = point.x - start.x
        const wy = (point.y - start.y) * 1.26
        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / Math.max(0.000001, vx * vx + vy * vy)))
        const candidate = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
        const distance = Math.hypot(point.x - candidate.x, (point.y - candidate.y) * 1.26)
        if (distance < best.distance) best = { ...candidate, distance }
      }
      return best
    }
    return slots.map((slot) => {
      const path = slot.zone === 'left' ? paths.left : paths.right
      const road = closest(slot, path)
      const radians = (slot.facingAngleDeg * Math.PI) / 180
      const facingDot = Math.cos(radians) * (road.x - slot.x) + Math.sin(radians) * ((road.y - slot.y) * 1.26)
      return { id: slot.id, leftEdge: slot.leftEdge, rightEdge: slot.rightEdge, roadDistance: road.distance, facingDot }
    })
  })
  layoutRelation.forEach((slot) => {
    const isAux = slot.id.includes('-aux-')
    expect(Math.min(slot.leftEdge, slot.rightEdge), slot.id).toBeGreaterThanOrEqual(isAux ? 12 : 24)
    expect(slot.roadDistance, slot.id).toBeGreaterThanOrEqual(0.105)
    expect(slot.roadDistance, slot.id).toBeLessThanOrEqual(isAux ? 0.34 : 0.24)
    expect(slot.facingDot, slot.id).toBeGreaterThan(0.04)
  })
})

test('shows opponent Diaochan live HP in the former time slot', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setGuardianHp('ghost', 72)
  })
  await expect(page.getByTestId('duel-time')).toContainText('72%')
  await expect(page.getByTestId('duel-time')).toHaveAttribute('data-value', '72')
})

test('uses same seed for equal recruit batches and no hidden ghost resources', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setSideCoins('player', 1000)
    window.__gameDebug!.setSideCoins('ghost', 1000)
    window.__gameDebug!.recruitBatch(true)
    window.__gameDebug!.advanceTime(0.6)
  })
  const state = await debugState(page)
  const playerBatch = state.player.reserveItems.map((item) => ({ ...item, id: '' }))
  const ghostBatchAfterDeploy = state.ghost.reserveItems.map((item) => ({ ...item, id: '' }))
  expect(state.ghost.metrics.batchRecruitCount).toBe(1)
  expect(state.player.metrics.batchRecruitCount).toBe(1)
  expect(Math.abs(state.ghost.coins - state.player.coins)).toBeLessThan(0.0001)
  expect(state.ghostReplay.failedActionCount).toBe(0)
  expect(playerBatch.length).toBe(6)
  expect(ghostBatchAfterDeploy.length).toBe(6)
  expect(ghostBatchAfterDeploy).toEqual(playerBatch)
})

test('replays ghost actions on simulated time and respects pause/resume', async ({ page }) => {
  await page.evaluate(() => window.__gameDebug!.advanceTime(0.6))
  let state = await debugState(page)
  expect(state.ghostReplay.nextActionIndex).toBe(1)

  await page.evaluate(() => window.__gameDebug!.pause())
  await page.evaluate(() => window.__gameDebug!.advanceTime(5))
  state = await debugState(page)
  expect(state.phase).toBe('paused')
  expect(state.ghostReplay.nextActionIndex).toBe(1)

  await page.evaluate(() => {
    window.__gameDebug!.resume()
    window.__gameDebug!.setGameSpeed(2)
    window.__gameDebug!.advanceTime(1)
  })
  state = await debugState(page)
  expect(state.elapsedSeconds).toBeGreaterThan(2)
  expect(state.ghostReplay.nextActionIndex).toBeGreaterThan(1)
  expect(state.ghostReplay.failedActionCount).toBe(0)
  await expect(page.locator('[data-testid^="ghost-unit-"]').first()).toBeVisible()
})

test('spawns four mirrored enemy paths from left and right sides', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setGameSpeed(0)
    window.__gameDebug!.spawnEnemy('player', 'left', 'normal', 0)
    window.__gameDebug!.spawnEnemy('player', 'right', 'normal', 0)
    window.__gameDebug!.spawnEnemy('ghost', 'left', 'normal', 0)
    window.__gameDebug!.spawnEnemy('ghost', 'right', 'normal', 0)
  })
  await expect(page.locator('[data-target-side="player"][data-entry-side="left"]').first()).toBeVisible()
  await expect(page.locator('[data-target-side="player"][data-entry-side="right"]').first()).toBeVisible()
  await expect(page.locator('[data-target-side="ghost"][data-entry-side="left"]').first()).toBeVisible()
  await expect(page.locator('[data-target-side="ghost"][data-entry-side="right"]').first()).toBeVisible()

  let state = await debugState(page)
  const playerLeft = Object.values(state.player.enemies).find((enemy) => enemy.entrySide === 'left')!
  const ghostLeft = Object.values(state.ghost.enemies).find((enemy) => enemy.entrySide === 'left')!
  expect(playerLeft.pathId).toBe('player-left')
  expect(ghostLeft.pathId).toBe('ghost-left')

  const enemyOnRoadCenter = await page.locator('[data-target-side="player"][data-entry-side="left"]').first().evaluate((element) => {
    const progress = Number(element.getAttribute('data-progress'))
    const [first, second] = (document.querySelector('[data-testid="path-player-left"]')?.getAttribute('points') ?? '')
      .split(' ')
      .slice(0, 2)
      .map((pair) => pair.split(',').map(Number))
    return {
      x: Number(element.getAttribute('data-x')),
      y: Number(element.getAttribute('data-y')),
      expectedX: (first[0] + (second[0] - first[0]) * progress * 5) / 100,
      expectedY: (first[1] + (second[1] - first[1]) * progress * 5) / 100,
    }
  })
  expect(enemyOnRoadCenter.x).toBeCloseTo(enemyOnRoadCenter.expectedX)
  expect(enemyOnRoadCenter.y).toBeCloseTo(enemyOnRoadCenter.expectedY)

  await page.evaluate(() => {
    window.__gameDebug!.setGameSpeed(1)
    window.__gameDebug!.advanceTime(4)
  })
  state = await debugState(page)
  const movedPlayerLeft = Object.values(state.player.enemies).find((enemy) => enemy.entrySide === 'left')!
  const movedGhostLeft = Object.values(state.ghost.enemies).find((enemy) => enemy.entrySide === 'left')!
  expect(movedPlayerLeft.progress).toBeGreaterThan(playerLeft.progress)
  expect(movedGhostLeft.progress).toBeGreaterThan(ghostLeft.progress)
})

test('renders spear thrust visuals from the shared attack geometry', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setReserveItems([{ id: 'visual-spear', type: 'troop', troopType: 'spear', star: 1 }])
  })
  await page.getByTestId('recruit-slot-0').locator('.reserve-item').dragTo(page.getByTestId('player-left-active-3'))
  await page.evaluate(() => {
    window.__gameDebug!.spawnEnemy('player', 'left', 'normal', 0.928)
    window.__gameDebug!.spawnEnemy('player', 'left', 'normal', 0.934)
    window.__gameDebug!.spawnEnemy('player', 'left', 'normal', 0.94)
    window.__gameDebug!.spawnEnemy('player', 'left', 'normal', 0.946)
    window.__gameDebug!.advanceTime(0.05)
  })

  const thrust = page.getByTestId('attack-trace-thrust').first()
  await expect(thrust).toBeVisible()
  const geometry = JSON.parse((await thrust.getAttribute('data-geometry'))!)
  expect(geometry.shape).toBe('strip')
  expect(geometry.lengthRatio).toBeCloseTo(0.27)
  expect(geometry.widthRatio).toBeCloseTo(0.075)
  await expect(page.getByTestId('spear-thrust-body').first()).toHaveAttribute('data-facing-angle-deg', String(geometry.facingAngleDeg))
  await expect(page.getByTestId('spear-beam-core').first()).toHaveAttribute('data-length-ratio', String(geometry.lengthRatio))
  await expect(page.getByTestId('spear-impact-marker')).toHaveCount(4)
  await expect(page.getByTestId('pierce-count')).toContainText('贯穿×4')
})

test('settles win, loss, draw and restarts', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setGuardianHp('ghost', 0)
    window.__gameDebug!.advanceTime(0.02)
  })
  await expect(page.getByTestId('result-modal')).toBeVisible()
  expect((await debugState(page)).phase).toBe('won')
  await page.getByTestId('restart-button').click()
  await expect(page.getByTestId('duel-phase')).toHaveAttribute('data-value', 'playing')

  await page.evaluate(() => {
    window.__gameDebug!.setGuardianHp('player', 0)
    window.__gameDebug!.advanceTime(0.02)
  })
  expect((await debugState(page)).phase).toBe('lost')
  await page.getByTestId('restart-button').click()
  await expect(page.getByTestId('duel-phase')).toHaveAttribute('data-value', 'playing')

  await page.evaluate(() => {
    window.__gameDebug!.setGuardianHp('player', 0)
    window.__gameDebug!.setGuardianHp('ghost', 0)
    window.__gameDebug!.advanceTime(0.02)
  })
  expect((await debugState(page)).phase).toBe('draw')
})

test('runs 180 simulated seconds without stuck waves or ghost failures', async ({ page }) => {
  await page.evaluate(() => {
    window.__gameDebug!.setGuardianHp('player', 10000)
    window.__gameDebug!.setGuardianHp('ghost', 10000)
    window.__gameDebug!.advanceTime(180)
  })
  const state = await debugState(page)
  expect(state.elapsedSeconds).toBeGreaterThan(179.9)
  expect(state.player.totalSpawned).toBeGreaterThan(20)
  expect(state.ghost.totalSpawned).toBeGreaterThan(20)
  expect(Math.max(state.player.lastEnemyMovedAt, state.ghost.lastEnemyMovedAt)).toBeGreaterThan(100)
  expect(state.ghostReplay.failedActionCount).toBe(0)
  expect(state.metrics.consoleErrorCount).toBe(0)
})
