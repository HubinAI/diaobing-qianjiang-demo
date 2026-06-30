import type { GeneralId, SideId, Star, TroopType, WeaponId } from '../types/game'

export type GhostDifficulty = 'easy' | 'normal' | 'hard'

export type GhostActionType =
  | 'recruit_batch'
  | 'deploy'
  | 'move'
  | 'merge'
  | 'unlock_slot'
  | 'upgrade_general'
  | 'equip_weapon'

export interface RecruitBatchPayload {
  expectedBatchIndex: number
  confirmed?: boolean
}

export interface RecruitItemRef {
  batchIndex: number
  recruitSlotIndex: number
  expectedType: TroopType | 'general' | 'weapon'
  expectedStar?: Star
  expectedGeneralId?: GeneralId
  expectedWeaponId?: WeaponId
}

export interface DeployPayload {
  item: RecruitItemRef
  targetSlotId: string
}

export interface MovePayload {
  fromSlotId: string
  targetSlotId: string
}

export interface MergePayload {
  fromSlotId: string
  targetSlotId: string
  expectedResultStar: Star
}

export interface UnlockSlotPayload {
  targetSlotId: string
}

export interface UpgradeGeneralPayload {
  item: RecruitItemRef
  targetGeneralSlotId: string
  expectedResultStar: Star
}

export interface EquipWeaponPayload {
  item: RecruitItemRef
  targetGeneralSlotId: string
}

export type GhostActionPayload =
  | RecruitBatchPayload
  | DeployPayload
  | MovePayload
  | MergePayload
  | UnlockSlotPayload
  | UpgradeGeneralPayload
  | EquipWeaponPayload

export interface GhostAction {
  id: string
  at: number
  type: GhostActionType
  payload: GhostActionPayload
}

export interface GhostRunFile {
  schemaVersion: number
  rulesetVersion: string
  configHash: string
  ghostId: string
  displayName: string
  avatarId: string
  difficulty: GhostDifficulty
  seed: string
  recordedAt: string
  durationSeconds: number
  result: 'win' | 'lose' | 'draw'
  finalGuardianHp: number
  actions: GhostAction[]
  metrics: {
    recruitCount: number
    deployCount: number
    mergeCount: number
    unlockCount: number
    generalCount: number
    weaponCount: number
  }
}

export interface GameCommand {
  sideId: SideId
  type: GhostActionType
  payload: GhostActionPayload
  source: 'player' | 'ghost' | 'debug'
  actionId?: string
}

export interface CommandResult {
  ok: boolean
  state?: import('../types/game').DuelGameState
  reason?: string
}
