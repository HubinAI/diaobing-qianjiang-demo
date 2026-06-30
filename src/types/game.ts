export type LaneId = 'left' | 'middle' | 'right'
export type SlotLane = LaneId | 'merge'
export type SideId = 'player' | 'ghost'
export type EntrySide = 'left' | 'right'
export type TroopType = 'blade' | 'spear' | 'archer'
export type GeneralId = 'guanyu' | 'zhaoyun' | 'huangzhong'
export type WeaponId = 'greenDragonBlade' | 'dragonSpear' | 'sunsetBow'
export type EnemyType = 'normal' | 'fast' | 'heavy' | 'boss'
export type Star = 1 | 2 | 3 | 4 | 5
export type EnemyPathId = 'player-left' | 'player-right' | 'ghost-left' | 'ghost-right'
export type AttackShape = 'circle' | 'strip' | 'arc'

export interface WorldPoint {
  x: number
  y: number
}

export interface AttackGeometry {
  shape: AttackShape
  origin: WorldPoint
  facingAngleDeg: number
  radiusRatio?: number
  lengthRatio?: number
  widthRatio?: number
  arcRadiusRatio?: number
  arcAngleDeg?: number
  maxTargets: number
}

export interface TroopUnit {
  id: string
  kind: 'troop'
  troopType: TroopType
  star: Star
  lane: SlotLane
  slotId: string
  nextAttackAt: number
}

export interface GeneralUnit {
  id: string
  kind: 'general'
  generalId: GeneralId
  star: Star
  lane: SlotLane
  slotId: string
  equippedWeapon?: WeaponId
  nextAttackAt: number
}

export interface EnemyUnit {
  id: string
  enemyType: EnemyType
  targetSide: SideId
  entrySide: EntrySide
  lane: LaneId
  corridor: 'left' | 'right'
  pathId: EnemyPathId
  hp: number
  maxHp: number
  speed: number
  gateDamage: number
  coinReward: number
  progress: number
}

export interface HitEffect {
  id: string
  lane: LaneId
  corridor: 'left' | 'right'
  pathId: EnemyPathId
  progress: number
  text: string
  kind: 'hit' | 'kill' | 'sweep' | 'volley' | 'thrust'
  at: number
}

export interface AttackImpact {
  enemyId: string
  damage: number
  damageRatio: number
  order: number
}

export interface AttackTrace {
  id: string
  sourceUnitId: string
  targetEnemyIds: string[]
  targetImpacts: AttackImpact[]
  attackType: 'slash' | 'thrust' | 'arrow' | 'generalSkill'
  lane: LaneId
  corridor: 'left' | 'right'
  pathId: EnemyPathId
  progress: number
  sourceLane: SlotLane
  sourcePoint: WorldPoint
  targetPoint: WorldPoint
  geometry: AttackGeometry
  damage: number
  createdAt: number
  impactAt: number
  expiresAt: number
  durationMs: number
  resolved: boolean
}

export interface CoinFlyEffect {
  id: string
  amount: number
  pathId: EnemyPathId
  progress: number
  createdAt: number
  collectAt: number
  collected: boolean
}

export interface DeploymentSlot {
  id: string
  sideId: SideId
  zone: 'left' | 'right' | 'center'
  lane: SlotLane
  unlocked: boolean
  index: number
  x: number
  y: number
  facingAngleDeg: number
  occupantId?: string
}

export type ReserveItem =
  | { id: string; type: 'troop'; troopType: TroopType; star: Star; batchIndex?: number; recruitSlotIndex?: number }
  | { id: string; type: 'shovel'; batchIndex?: number; recruitSlotIndex?: number }
  | { id: string; type: 'general'; generalId: GeneralId; batchIndex?: number; recruitSlotIndex?: number }
  | { id: string; type: 'weapon'; weaponId: WeaponId; batchIndex?: number; recruitSlotIndex?: number }

export interface RunMetrics {
  seed: string
  result: 'win' | 'lose' | 'draw' | 'playing'
  durationSeconds: number
  reachedWave: number
  totalKills: number
  batchRecruitCount: number
  batchItemsGenerated: number
  batchItemsUsed: number
  batchItemsOverwritten: number
  rareItemsOverwritten: number
  averageSecondsBetweenRecruit: number
  currentRecruitCost: number
  lastRecruitAt?: number
  deployCount: number
  recruitCount: number
  mergeCount: number
  crossLaneMoveCount: number
  shovelUseCount: number
  unlockedSlotCount: number
  maxUnlockedSlots: number
  generalsObtained: string[]
  generalStarLevels: Record<string, number>
  exclusiveWeaponsEquipped: string[]
  guardianHpRemaining: number
  reserveFullCount: number
  leakedByLane: Record<LaneId, number>
  restartClicked: boolean
  runtimeErrorCount: number
}

export interface GameState {
  phase: 'idle' | 'playing' | 'paused' | 'won' | 'lost'
  seed: string
  rngState: number
  elapsedSeconds: number
  speedMultiplier: number
  waveIndex: number
  waveElapsed: number
  waveBreakRemaining: number
  nextSpawnIndex: number
  spawnedInWave: Record<string, number>
  totalSpawned: number
  spawningPausedByCap: boolean
  lastEnemyMovedAt: number
  lastEnemySpawnedAt: number
  lastMeaningfulProgressAt: number
  selectedUnitId?: string
  nextGeneralSkillAt: Partial<Record<GeneralId, number>>
  coins: number
  guardianHp: number
  autoShovels: number
  nextShovelAt: number
  reserveItems: ReserveItem[]
  recruitsSinceGeneral: number
  slots: DeploymentSlot[]
  troops: Record<string, TroopUnit>
  generals: Record<string, GeneralUnit>
  enemies: Record<string, EnemyUnit>
  hitEffects: HitEffect[]
  attackTraces: AttackTrace[]
  coinFlyEffects: CoinFlyEffect[]
  selectedShovel?: { source: 'auto' } | { source: 'reserve'; itemId: string }
  invalidDropTargetId?: string
  showCompendium: boolean
  showDebug: boolean
  showEnemyHp: boolean
  showDps: boolean
  pendingRecruitConfirmation: boolean
  toast?: string
  toastUntil: number
  lastEffect?: { id: string; text: string; at: number }
  metrics: RunMetrics
}

export type BoardUnit = TroopUnit | GeneralUnit

export type DragPayload = { source: 'reserve'; itemId: string } | { source: 'slot'; unitId: string }

export type DropTarget = { type: 'slot'; slotId: string } | { type: 'reserve'; index: number }

export type DuelPhase = 'idle' | 'playing' | 'paused' | 'won' | 'lost' | 'draw'

export interface GhostActionFailure {
  actionId: string
  at: number
  reason:
    | 'insufficient_coins'
    | 'item_mismatch'
    | 'slot_occupied'
    | 'slot_locked'
    | 'merge_mismatch'
    | 'ruleset_mismatch'
    | 'unknown'
}

export interface GhostReplayState {
  fileId: string
  difficulty: 'easy' | 'normal' | 'hard'
  nextActionIndex: number
  failedActionCount: number
  failures: GhostActionFailure[]
  completed: boolean
  lastActionId?: string
}

export interface DuelRunMetrics {
  matchId: string
  seed: string
  ghostId: string
  ghostDifficulty: 'easy' | 'normal' | 'hard'
  result: 'won' | 'lost' | 'draw' | 'playing'
  durationSeconds: number
  playerGuardianHp: number
  ghostGuardianHp: number
  firstPlayerAttackAt?: number
  firstGhostAttackAt?: number
  firstAttackAtByType: Partial<Record<TroopType, number>>
  hpLeadChangeCount: number
  closestHpDifference: number
  playerRecruitCount: number
  ghostRecruitCount: number
  playerMergeCount: number
  ghostMergeCount: number
  ghostActionCount: number
  ghostActionFailureCount: number
  playerTotalKills: number
  ghostTotalKills: number
  playerLeaks: number
  ghostLeaks: number
  restartClicked: boolean
  consoleErrorCount: number
}

export interface DuelGameState {
  phase: DuelPhase
  seed: string
  elapsedSeconds: number
  speedMultiplier: number
  player: GameState
  ghost: GameState
  selectedSideId: SideId
  selectedUnitId?: string
  selectedShovel?: { source: 'auto'; sideId: SideId } | { source: 'reserve'; sideId: SideId; itemId: string }
  pendingRecruitConfirmationSide?: SideId
  toast?: string
  toastUntil: number
  lastEffect?: { id: string; text: string; at: number; sideId: SideId }
  ghostReplay: GhostReplayState
  ghostId: string
  ghostName: string
  ghostAvatarId: string
  ghostDifficulty: 'easy' | 'normal' | 'hard'
  showCompendium: boolean
  showDebug: boolean
  showEnemyHp: boolean
  showDps: boolean
  metrics: DuelRunMetrics
}

export interface GameDebugApi {
  getState: () => DuelGameState
  reset: (seed?: string) => void
  advanceTime: (seconds: number) => void
  spawnEnemy: (sideId?: SideId, entrySide?: EntrySide, enemyType?: EnemyType, progress?: number) => void
  spawnWave: (index: number) => void
  setCoins: (coins: number) => void
  setSideCoins: (sideId: SideId, coins: number) => void
  recruitBatch: (confirmed?: boolean) => void
  createTroop: (troopType?: TroopType, star?: Star) => void
  setReserveItems: (items: ReserveItem[]) => void
  unlockAllSlots: () => void
  setGameSpeed: (speed: number) => void
  setGuardianHp: (sideId: SideId, hp: number) => void
  setEnemyHp: (sideId: SideId, enemyId: string, hp: number) => void
  pause: () => void
  resume: () => void
}

declare global {
  interface Window {
    __gameDebug?: GameDebugApi
  }
}
