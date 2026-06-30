import { attackShapeConfig, enemyConfig, gameConfig, generalConfig, troopConfig } from '../config/gameConfig'
import { getAttackGeometryForUnit, getTargetsInAttackArea, troopTypeForUnit, type AttackTarget } from './attackGeometry'
import { pathIdFor } from './paths'
import { waves } from './waves'
import type {
  AttackGeometry,
  AttackImpact,
  AttackTrace,
  BoardUnit,
  CoinFlyEffect,
  EnemyType,
  EnemyUnit,
  EntrySide,
  GameState,
  HitEffect,
  SideId,
  TroopType,
} from '../types/game'

function enemyKey(waveIndex: number, entrySide: EntrySide, enemyType: EnemyType) {
  return `${waveIndex}:${entrySide}:${enemyType}`
}

function sideIdFromState(state: GameState): SideId {
  return state.slots[0]?.sideId ?? 'player'
}

function createEnemy(waveIndex: number, targetSide: SideId, entrySide: EntrySide, enemyType: EnemyType, order: number): EnemyUnit {
  const config = enemyConfig[enemyType]
  const hpMultiplier =
    (1 + (waveIndex - 1) * gameConfig.enemyHpMultiplierPerWave) * (enemyType === 'boss' ? gameConfig.bossHpMultiplier : 1)
  const speedMultiplier = 1 + (waveIndex - 1) * gameConfig.enemySpeedMultiplierPerWave
  const gateDamageMultiplier = 1 + (waveIndex - 1) * gameConfig.enemyGateDamageMultiplierPerWave
  const hp = Math.round(config.hp * hpMultiplier)
  return {
    id: `${targetSide}-enemy-${waveIndex}-${entrySide}-${enemyType}-${order}`,
    enemyType,
    targetSide,
    entrySide,
    lane: entrySide === 'left' ? 'left' : 'right',
    corridor: entrySide,
    pathId: pathIdFor(targetSide, entrySide),
    hp,
    maxHp: hp,
    speed: config.speed * speedMultiplier,
    gateDamage: Math.ceil(config.gateDamage * gateDamageMultiplier),
    coinReward: config.coinReward,
    progress: 0,
  }
}

function allSpawnsCompleted(state: GameState) {
  const wave = waves[state.waveIndex - 1]
  if (!wave) return true
  return state.nextSpawnIndex >= wave.spawnQueue.length
}

function spawnEnemies(state: GameState): GameState {
  const wave = waves[state.waveIndex - 1]
  if (!wave) return state
  const targetSide = sideIdFromState(state)

  let enemies = state.enemies
  let spawnedInWave = state.spawnedInWave
  let nextSpawnIndex = state.nextSpawnIndex
  let totalSpawned = state.totalSpawned
  let aliveCount = Object.keys(enemies).length
  let spawningPausedByCap = state.spawningPausedByCap
  let lastEnemySpawnedAt = state.lastEnemySpawnedAt
  let lastMeaningfulProgressAt = state.lastMeaningfulProgressAt

  if (spawningPausedByCap && aliveCount > gameConfig.resumeSpawningEnemyCount) {
    return state
  }
  if (spawningPausedByCap && aliveCount <= gameConfig.resumeSpawningEnemyCount) {
    spawningPausedByCap = false
  }

  while (
    nextSpawnIndex < wave.spawnQueue.length &&
    wave.spawnQueue[nextSpawnIndex].at <= state.waveElapsed &&
    aliveCount < gameConfig.maxAliveEnemies
  ) {
    const entry = wave.spawnQueue[nextSpawnIndex]
    const enemy = createEnemy(wave.index, targetSide, entry.entrySide, entry.enemyType, nextSpawnIndex + 1)
    const key = enemyKey(wave.index, entry.entrySide, entry.enemyType)
    enemies = { ...enemies, [enemy.id]: enemy }
    spawnedInWave = { ...spawnedInWave, [key]: (spawnedInWave[key] ?? 0) + 1 }
    nextSpawnIndex += 1
    totalSpawned += 1
    aliveCount += 1
    lastEnemySpawnedAt = state.elapsedSeconds
    lastMeaningfulProgressAt = state.elapsedSeconds
  }

  if (aliveCount >= gameConfig.maxAliveEnemies && nextSpawnIndex < wave.spawnQueue.length) {
    spawningPausedByCap = true
  }

  return {
    ...state,
    enemies,
    spawnedInWave,
    nextSpawnIndex,
    totalSpawned,
    spawningPausedByCap,
    lastEnemySpawnedAt,
    lastMeaningfulProgressAt,
  }
}

function moveEnemies(state: GameState, delta: number): GameState {
  let guardianHp = state.guardianHp
  const enemies: Record<string, EnemyUnit> = {}
  let leakedByLane = state.metrics.leakedByLane
  let moved = false
  let gateHit = false

  for (const enemy of Object.values(state.enemies)) {
    const nextProgress = enemy.progress + enemy.speed * delta
    if (nextProgress >= 1) {
      guardianHp -= enemy.gateDamage
      gateHit = true
      leakedByLane = {
        ...leakedByLane,
        [enemy.lane]: leakedByLane[enemy.lane] + 1,
      }
      continue
    }
    if (nextProgress !== enemy.progress) moved = true
    enemies[enemy.id] = { ...enemy, progress: nextProgress }
  }

  return {
    ...state,
    guardianHp: Math.max(0, guardianHp),
    enemies,
    lastEnemyMovedAt: moved ? state.elapsedSeconds : state.lastEnemyMovedAt,
    lastMeaningfulProgressAt: moved || gateHit ? state.elapsedSeconds : state.lastMeaningfulProgressAt,
    metrics: {
      ...state.metrics,
      leakedByLane,
      guardianHpRemaining: Math.max(0, guardianHp),
    },
  }
}

function activeGeneral(state: GameState, troopType: TroopType) {
  return Object.values(state.generals).find((general) => generalConfig[general.generalId].troopType === troopType)
}

function getAttackProfile(state: GameState, unit: BoardUnit) {
  const troopType = troopTypeForUnit(unit)
  const config = troopConfig[troopType]
  const starMultiplier =
    unit.kind === 'troop' ? gameConfig.starMultiplier[unit.star] : gameConfig.generalStarMultiplier[unit.star]
  let attack = config.attack * starMultiplier
  const interval = config.attackInterval

  const general = activeGeneral(state, troopType)
  if (unit.kind === 'troop' && general) {
    attack *= 1 + gameConfig.generalTroopBuff[general.star]
  }

  return {
    troopType,
    attack,
    interval,
  }
}

function attackTypeFor(troopType: TroopType): AttackTrace['attackType'] {
  if (troopType === 'blade') return 'slash'
  if (troopType === 'spear') return 'thrust'
  return 'arrow'
}

function createAttackTrace(
  state: GameState,
  unit: BoardUnit,
  troopType: TroopType,
  geometry: AttackGeometry,
  targets: AttackTarget[],
  targetImpacts: AttackImpact[],
): AttackTrace | undefined {
  const primary = targets[0]
  if (!primary) return undefined
  const windupSeconds = gameConfig.attackWindupSeconds[troopType]
  const travelSeconds = gameConfig.projectileTravelSeconds[troopType]
  const impactAt = state.elapsedSeconds + windupSeconds + travelSeconds
  const damage = targetImpacts.reduce((sum, impact) => sum + impact.damage, 0)
  return {
    id: `trace-${Math.round(state.elapsedSeconds * 1000)}-${unit.id}-${primary.enemy.id}-${Math.round(damage)}`,
    sourceUnitId: unit.id,
    targetEnemyIds: targets.map((target) => target.enemy.id),
    targetImpacts,
    attackType: attackTypeFor(troopType),
    lane: primary.enemy.lane,
    corridor: primary.enemy.corridor,
    pathId: primary.enemy.pathId,
    progress: primary.enemy.progress,
    sourceLane: unit.lane,
    sourcePoint: geometry.origin,
    targetPoint: primary.point,
    geometry,
    damage,
    createdAt: state.elapsedSeconds,
    impactAt,
    expiresAt: impactAt + gameConfig.attackEventLingerSeconds,
    durationMs: Math.round((windupSeconds + travelSeconds) * 1000),
    resolved: false,
  }
}

function damageEnemy(
  state: GameState,
  enemies: Record<string, EnemyUnit>,
  enemyId: string,
  damage: number,
): { enemies: Record<string, EnemyUnit>; totalKills: number; killed: boolean; effect?: HitEffect; coinEffect?: CoinFlyEffect } {
  const enemy = enemies[enemyId]
  if (!enemy) return { enemies, totalKills: state.metrics.totalKills, killed: false }

  const nextHp = enemy.hp - damage
  const effect: HitEffect = {
    id: `hit-${Math.round(state.elapsedSeconds * 1000)}-${enemy.id}-${Math.round(enemy.hp)}-${Math.round(damage)}`,
    lane: enemy.lane,
    corridor: enemy.corridor,
    pathId: enemy.pathId,
    progress: enemy.progress,
    text: nextHp <= 0 ? `+${enemy.coinReward}` : `-${Math.round(damage)}`,
    kind: nextHp <= 0 ? 'kill' : 'hit',
    at: state.elapsedSeconds,
  }

  if (nextHp > 0) {
    return {
      enemies: { ...enemies, [enemy.id]: { ...enemy, hp: nextHp } },
      totalKills: state.metrics.totalKills,
      killed: false,
      effect,
    }
  }

  const nextEnemies = { ...enemies }
  delete nextEnemies[enemy.id]
  return {
    enemies: nextEnemies,
    totalKills: state.metrics.totalKills + 1,
    killed: true,
    effect,
    coinEffect: {
      id: `coin-${Math.round(state.elapsedSeconds * 1000)}-${enemy.id}`,
      amount: enemy.coinReward,
      pathId: enemy.pathId,
      progress: enemy.progress,
      createdAt: state.elapsedSeconds,
      collectAt: state.elapsedSeconds + gameConfig.coinFlySeconds,
      collected: false,
    },
  }
}

function processAttacks(state: GameState): GameState {
  const troops = { ...state.troops }
  const generals = { ...state.generals }
  const enemies = state.enemies
  const rngState = state.rngState
  const lastEffect = state.lastEffect
  let attackTraces = state.attackTraces.filter((trace) => state.elapsedSeconds < trace.expiresAt)

  const units: BoardUnit[] = [...Object.values(troops), ...Object.values(generals)]

  for (const unit of units) {
    const currentUnit = unit.kind === 'troop' ? troops[unit.id] : generals[unit.id]
    if (!currentUnit || state.elapsedSeconds < currentUnit.nextAttackAt) continue

    const profile = getAttackProfile(state, currentUnit)
    const geometry = getAttackGeometryForUnit(state, currentUnit)
    if (!geometry) continue

    const targets = getTargetsInAttackArea(Object.values(enemies), geometry)
    if (targets.length === 0) continue

    const shapeConfig = attackShapeConfig[profile.troopType]
    if (profile.troopType === 'spear') {
      const ratios = shapeConfig.penetrationDamageRatio ?? [1]
      const targetImpacts = targets.map((target, index) => {
        const damageRatio = ratios[index] ?? ratios[ratios.length - 1] ?? 1
        return {
          enemyId: target.enemy.id,
          damage: profile.attack * damageRatio,
          damageRatio,
          order: index,
        }
      })
      const trace = createAttackTrace(state, currentUnit, profile.troopType, geometry, targets, targetImpacts)
      if (trace) attackTraces = [...attackTraces, trace]
    } else if (profile.troopType === 'blade') {
      const damageRatio = shapeConfig.areaDamageRatio ?? 1
      const targetImpacts = targets.map((target, index) => ({
        enemyId: target.enemy.id,
        damage: profile.attack * damageRatio,
        damageRatio,
        order: index,
      }))
      const trace = createAttackTrace(state, currentUnit, profile.troopType, geometry, targets, targetImpacts)
      if (trace) attackTraces = [...attackTraces, trace]
    } else {
      const trace = createAttackTrace(state, currentUnit, profile.troopType, geometry, [targets[0]], [
        { enemyId: targets[0].enemy.id, damage: profile.attack, damageRatio: 1, order: 0 },
      ])
      if (trace) attackTraces = [...attackTraces, trace]
    }

    const updated = { ...currentUnit, nextAttackAt: state.elapsedSeconds + profile.interval }
    if (updated.kind === 'troop') troops[updated.id] = updated
    else generals[updated.id] = updated
  }

  return {
    ...state,
    troops,
    generals,
    enemies,
    rngState,
    lastEffect,
    attackTraces: attackTraces.slice(-40),
  }
}

function hitKindForTrace(trace: AttackTrace): HitEffect['kind'] {
  if (trace.attackType === 'thrust') return 'thrust'
  if (trace.attackType === 'generalSkill') return 'volley'
  return 'hit'
}

function processAttackImpacts(state: GameState): GameState {
  let enemies = state.enemies
  let totalKills = state.metrics.totalKills
  let hitEffects = state.hitEffects.filter((effect) => state.elapsedSeconds - effect.at < 0.75)
  let coinFlyEffects = state.coinFlyEffects
  let lastMeaningfulProgressAt = state.lastMeaningfulProgressAt

  const attackTraces = state.attackTraces
    .filter((trace) => state.elapsedSeconds < trace.expiresAt)
    .map((trace) => {
      if (trace.resolved || state.elapsedSeconds < trace.impactAt) return trace

      trace.targetImpacts.forEach((impact) => {
        const result = damageEnemy({ ...state, enemies, metrics: { ...state.metrics, totalKills } }, enemies, impact.enemyId, impact.damage)
        enemies = result.enemies
        totalKills = result.totalKills
        if (result.effect) {
          hitEffects = [...hitEffects, { ...result.effect, kind: hitKindForTrace(trace) }]
          lastMeaningfulProgressAt = state.elapsedSeconds
        }
        if (result.coinEffect) {
          coinFlyEffects = [...coinFlyEffects, result.coinEffect]
          lastMeaningfulProgressAt = state.elapsedSeconds
        }
      })

      return { ...trace, resolved: true }
    })

  return {
    ...state,
    enemies,
    hitEffects: hitEffects.slice(-36),
    attackTraces: attackTraces.slice(-50),
    coinFlyEffects: coinFlyEffects.slice(-30),
    lastMeaningfulProgressAt,
    metrics: {
      ...state.metrics,
      totalKills,
    },
  }
}

function processCoinCollection(state: GameState): GameState {
  let coins = state.coins
  let lastMeaningfulProgressAt = state.lastMeaningfulProgressAt
  const coinFlyEffects = state.coinFlyEffects
    .map((effect) => {
      if (effect.collected || state.elapsedSeconds < effect.collectAt) return effect
      coins += effect.amount
      lastMeaningfulProgressAt = state.elapsedSeconds
      return { ...effect, collected: true }
    })
    .filter((effect) => state.elapsedSeconds - effect.collectAt < 0.5)

  return {
    ...state,
    coins,
    coinFlyEffects,
    lastMeaningfulProgressAt,
  }
}

function applySkillDamage(
  state: GameState,
  enemies: Record<string, EnemyUnit>,
  totalKills: number,
  enemyId: string,
  damage: number,
) {
  return damageEnemy({ ...state, metrics: { ...state.metrics, totalKills } }, enemies, enemyId, damage)
}

function processGeneralSkills(state: GameState): GameState {
  let enemies = state.enemies
  let totalKills = state.metrics.totalKills
  const nextGeneralSkillAt = { ...state.nextGeneralSkillAt }
  let lastEffect = state.lastEffect
  let hitEffects = state.hitEffects.filter((effect) => state.elapsedSeconds - effect.at < 0.75)
  let coinFlyEffects = state.coinFlyEffects
  let lastMeaningfulProgressAt = state.lastMeaningfulProgressAt
  const huangzhong = Object.values(state.generals).find((general) => general.generalId === 'huangzhong')

  if (huangzhong && state.elapsedSeconds >= (nextGeneralSkillAt.huangzhong ?? state.elapsedSeconds + gameConfig.generalSkills.huangzhongVolleySeconds)) {
    const interval = huangzhong.equippedWeapon
      ? gameConfig.generalSkills.huangzhongWeaponVolleySeconds
      : gameConfig.generalSkills.huangzhongVolleySeconds
    const archers = Object.values(state.troops).filter((troop) => troop.troopType === 'archer' && troop.lane === huangzhong.lane)

    archers.forEach((archer) => {
      const profile = getAttackProfile(state, archer)
      const geometry = getAttackGeometryForUnit(state, archer)
      const targets = geometry ? getTargetsInAttackArea(Object.values(enemies), geometry) : []
      const target = targets[0]
      if (!target) return
      const result = applySkillDamage(
        state,
        enemies,
        totalKills,
        target.enemy.id,
        profile.attack * (huangzhong.equippedWeapon ? gameConfig.generalSkills.huangzhongWeaponVolleyDamageRatio : 1),
      )
      enemies = result.enemies
      totalKills = result.totalKills
      if (result.effect) {
        hitEffects = [...hitEffects, { ...result.effect, kind: 'volley', text: result.effect.text.startsWith('+') ? result.effect.text : `齐${result.effect.text}` }]
        lastMeaningfulProgressAt = state.elapsedSeconds
      }
      if (result.coinEffect) {
        coinFlyEffects = [...coinFlyEffects, result.coinEffect]
        lastMeaningfulProgressAt = state.elapsedSeconds
      }
    })

    nextGeneralSkillAt.huangzhong = state.elapsedSeconds + interval
    if (archers.length > 0) lastEffect = { id: `${state.elapsedSeconds}-volley`, text: '齐射', at: state.elapsedSeconds }
  }

  const zhaoyun = Object.values(state.generals).find((general) => general.generalId === 'zhaoyun' && general.equippedWeapon)
  if (zhaoyun && state.elapsedSeconds >= (nextGeneralSkillAt.zhaoyun ?? state.elapsedSeconds + gameConfig.generalSkills.zhaoyunThrustSeconds)) {
    const geometry = getAttackGeometryForUnit(state, zhaoyun)
    const targets = geometry ? getTargetsInAttackArea(Object.values(enemies), geometry).slice(0, gameConfig.generalSkills.zhaoyunThrustTargets) : []

    targets.forEach((target) => {
      const result = applySkillDamage(state, enemies, totalKills, target.enemy.id, gameConfig.generalSkills.zhaoyunThrustDamage)
      enemies = result.enemies
      totalKills = result.totalKills
      if (result.effect) {
        hitEffects = [...hitEffects, { ...result.effect, kind: 'thrust', text: result.effect.text.startsWith('+') ? result.effect.text : `刺${result.effect.text}` }]
        lastMeaningfulProgressAt = state.elapsedSeconds
      }
      if (result.coinEffect) {
        coinFlyEffects = [...coinFlyEffects, result.coinEffect]
        lastMeaningfulProgressAt = state.elapsedSeconds
      }
    })

    nextGeneralSkillAt.zhaoyun = state.elapsedSeconds + gameConfig.generalSkills.zhaoyunThrustSeconds
    if (targets.length > 0) lastEffect = { id: `${state.elapsedSeconds}-thrust`, text: '突刺', at: state.elapsedSeconds }
  }

  return {
    ...state,
    enemies,
    nextGeneralSkillAt,
    lastEffect,
    hitEffects: hitEffects.slice(-36),
    coinFlyEffects: coinFlyEffects.slice(-30),
    lastMeaningfulProgressAt,
    metrics: {
      ...state.metrics,
      totalKills,
    },
  }
}

function settleWave(state: GameState): GameState {
  if (state.waveBreakRemaining > 0) return state
  if (!allSpawnsCompleted(state) || Object.keys(state.enemies).length > 0) return state

  if (state.waveIndex >= waves.length) {
    return {
      ...state,
      phase: 'won',
      metrics: {
        ...state.metrics,
        result: 'win',
        reachedWave: waves.length,
        guardianHpRemaining: state.guardianHp,
      },
    }
  }

  return {
    ...state,
    waveBreakRemaining: gameConfig.waveBreakSeconds,
    lastMeaningfulProgressAt: state.elapsedSeconds,
  }
}

export function tickCombat(state: GameState, delta: number): GameState {
  if (state.phase !== 'playing') return state

  let nextState: GameState = {
    ...state,
    elapsedSeconds: state.elapsedSeconds + delta,
    coins: state.coins + gameConfig.coinRegenPerSecond * delta,
  }

  if (nextState.waveBreakRemaining > 0) {
    const remaining = nextState.waveBreakRemaining - delta
    if (remaining <= 0) {
      nextState = {
        ...nextState,
        waveIndex: Math.min(waves.length, nextState.waveIndex + 1),
        waveElapsed: 0,
        waveBreakRemaining: 0,
        nextSpawnIndex: 0,
        spawningPausedByCap: false,
        spawnedInWave: {},
        lastMeaningfulProgressAt: nextState.elapsedSeconds,
      }
    } else {
      nextState = { ...nextState, waveBreakRemaining: remaining }
    }
  } else {
    nextState = {
      ...nextState,
      waveElapsed: nextState.waveElapsed + delta,
    }
    nextState = spawnEnemies(nextState)
  }

  nextState = moveEnemies(nextState, delta)
  nextState = processAttackImpacts(nextState)
  nextState = processAttacks(nextState)
  nextState = processGeneralSkills(nextState)
  nextState = processCoinCollection(nextState)

  if (nextState.guardianHp <= 0) {
    return {
      ...nextState,
      phase: 'lost',
      metrics: {
        ...nextState.metrics,
        result: 'lose',
        durationSeconds: nextState.elapsedSeconds,
        reachedWave: nextState.waveIndex,
        guardianHpRemaining: 0,
      },
    }
  }

  nextState = settleWave(nextState)

  return {
    ...nextState,
    metrics: {
      ...nextState.metrics,
      durationSeconds: nextState.elapsedSeconds,
      reachedWave: nextState.waveIndex,
      guardianHpRemaining: nextState.guardianHp,
    },
  }
}
