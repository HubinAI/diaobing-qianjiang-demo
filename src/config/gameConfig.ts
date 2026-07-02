import type { AttackShape, EnemyType, GeneralId, LaneId, TroopType, WeaponId } from '../types/game'

export const gameConfig = {
  guardianMaxHp: 100,
  initialCoins: 30,
  coinRegenPerSecond: 1.2,
  normalEnemyCoinReward: 2,
  eliteEnemyCoinReward: 5,
  bossCoinReward: 30,
  batchRecruitCost: 20,
  recruitCost: 20,
  recruitCostStart: 20,
  recruitCostStep: 5,
  recruitCostMax: 80,
  recruitBatchSize: 6,
  reserveCapacity: 6,
  initialShovels: 1,
  shovelRegenSeconds: 45,
  maxStoredShovels: 2,
  maxTroopStar: 5,
  maxGeneralStar: 5,
  battlefieldHeightToWidthRatio: 1.26,
  outerLaneCurveStart: 0.7,
  mergeZoneStartProgress: 0.85,
  waveBreakSeconds: 4,
  maxAliveEnemies: 24,
  resumeSpawningEnemyCount: 20,
  attackTraceMs: 220,
  attackWindupSeconds: {
    blade: 0.12,
    spear: 0.14,
    archer: 0.16,
  },
  projectileTravelSeconds: {
    blade: 0.12,
    spear: 0.18,
    archer: 0.46,
  },
  attackEventLingerSeconds: 0.35,
  coinFlySeconds: 0.55,
  enemyHpMultiplierPerWave: 0.28,
  enemySpeedMultiplierPerWave: 0.025,
  enemyGateDamageMultiplierPerWave: 0.12,
  bossHpMultiplier: 1.6,
  starMultiplier: {
    1: 1,
    2: 1.72,
    3: 2.95,
    4: 5.05,
    5: 8.6,
  },
  generalStarMultiplier: {
    1: 1,
    2: 1.55,
    3: 2.3,
    4: 3.35,
    5: 4.8,
  },
  generalTroopBuff: {
    1: 0.12,
    2: 0.18,
    3: 0.25,
    4: 0.34,
    5: 0.45,
  },
  generalLocalEffectMultiplier: {
    1: 1,
    2: 1.15,
    3: 1.35,
    4: 1.6,
    5: 1.95,
  },
  recruitWeights: {
    blade: 34,
    spear: 33,
    archer: 33,
    general: 16,
    exclusiveWeapon: 8,
  },
  generalSkills: {
    guanyuSweepChance: 0.2,
    guanyuSweepDamageRatio: 0.6,
    guanyuSweepTargets: 3,
    guanyuWeaponSweepChance: 0.35,
    guanyuWeaponSweepDamageRatio: 0.9,
    guanyuWeaponSweepTargets: 5,
    huangzhongVolleySeconds: 6,
    huangzhongWeaponVolleySeconds: 4,
    huangzhongWeaponVolleyDamageRatio: 1.3,
    zhaoyunThrustSeconds: 8,
    zhaoyunThrustDamage: 90,
    zhaoyunThrustTargets: 5,
  },
} as const

export const duelConfig = {
  rulesetVersion: 'ghost-duel-v1',
  configHash: 'round5-a81d2f',
  maxMatchSeconds: 300,
  leftSpawn: { x: 0, y: 0.5 },
  rightSpawn: { x: 1, y: 0.5 },
  leftCorridorX: 0.42,
  rightCorridorX: 0.58,
  maxAliveEnemiesPerSide: 24,
  maxAliveEnemiesTotal: 48,
  aheadThreshold: 0.1,
  behindThreshold: -0.1,
  useSameRecruitSeed: true,
  allowDynamicRubberBanding: false,
  simultaneousDeathResult: 'draw',
} as const

export const laneLabels: Record<LaneId, string> = {
  left: '左路',
  middle: '中路',
  right: '右路',
}

export const attackShapeConfig: Record<
  TroopType,
  {
    shape: AttackShape
    rangeLabel: string
    damageLabel: string
    radiusRatio?: number
    lengthRatio?: number
    widthRatio?: number
    arcRadiusRatio?: number
    arcAngleDeg?: number
    maxTargets: number
    areaDamageRatio?: number
    penetrationDamageRatio?: readonly number[]
  }
> = {
  blade: {
    shape: 'arc',
    rangeLabel: '半弧形短距离',
    damageLabel: '范围伤害',
    arcRadiusRatio: 0.15,
    arcAngleDeg: 160,
    maxTargets: 6,
    areaDamageRatio: 0.85,
  },
  spear: {
    shape: 'strip',
    rangeLabel: '长条形中距离',
    damageLabel: '贯穿伤害',
    lengthRatio: 0.27,
    widthRatio: 0.075,
    maxTargets: 4,
    penetrationDamageRatio: [1, 0.82, 0.68, 0.55],
  },
  archer: {
    shape: 'circle',
    rangeLabel: '圆形长距离',
    damageLabel: '单体攻击',
    radiusRatio: 0.36,
    maxTargets: 1,
  },
}

export const troopConfig: Record<
  TroopType,
  {
    label: string
    icon: string
    attack: number
    attackInterval: number
    activeRangeProgress: number
    colorClass: string
    attackStyle: string
  }
> = {
  blade: {
    label: '刀',
    icon: '刀',
    attack: 18,
    attackInterval: 1.05,
    activeRangeProgress: 0.32,
    colorClass: 'unit-blue',
    attackStyle: '范围攻击',
  },
  spear: {
    label: '枪',
    icon: '枪',
    attack: 11,
    attackInterval: 0.85,
    activeRangeProgress: 0.58,
    colorClass: 'unit-green',
    attackStyle: '贯穿攻击',
  },
  archer: {
    label: '弓',
    icon: '弓',
    attack: 7,
    attackInterval: 0.55,
    activeRangeProgress: 0.92,
    colorClass: 'unit-yellow',
    attackStyle: '单体攻击',
  },
}

export const generalConfig: Record<
  GeneralId,
  {
    label: string
    troopType: TroopType
    icon: string
    colorClass: string
    weaponId: WeaponId
    comboEffect: string
  }
> = {
  guanyu: {
    label: '关羽',
    troopType: 'blade',
    icon: '关羽',
    colorClass: 'general-green',
    weaponId: 'greenDragonBlade',
    comboEffect: '青龙偃月·横扫千军',
  },
  zhaoyun: {
    label: '赵云',
    troopType: 'spear',
    icon: '赵云',
    colorClass: 'general-blue',
    weaponId: 'dragonSpear',
    comboEffect: '龙胆突刺·破阵',
  },
  huangzhong: {
    label: '黄忠',
    troopType: 'archer',
    icon: '黄忠',
    colorClass: 'general-gold',
    weaponId: 'sunsetBow',
    comboEffect: '落日连珠·百步穿杨',
  },
}

export const weaponConfig: Record<
  WeaponId,
  { label: string; icon: string; generalId: GeneralId; colorClass: string }
> = {
  greenDragonBlade: {
    label: '青龙偃月刀',
    icon: '刀',
    generalId: 'guanyu',
    colorClass: 'weapon-purple',
  },
  dragonSpear: {
    label: '龙胆亮银枪',
    icon: '枪',
    generalId: 'zhaoyun',
    colorClass: 'weapon-purple',
  },
  sunsetBow: {
    label: '落日弓',
    icon: '弓',
    generalId: 'huangzhong',
    colorClass: 'weapon-orange',
  },
}

export const enemyConfig: Record<
  EnemyType,
  { label: string; hp: number; speed: number; gateDamage: number; coinReward: number; icon: string }
> = {
  normal: { label: '步卒', hp: 65, speed: 0.036, gateDamage: 4, coinReward: 2, icon: '卒' },
  fast: { label: '轻骑', hp: 48, speed: 0.062, gateDamage: 3, coinReward: 2, icon: '骑' },
  heavy: { label: '重甲', hp: 180, speed: 0.026, gateDamage: 9, coinReward: 5, icon: '甲' },
  boss: { label: 'Boss', hp: 1800, speed: 0.018, gateDamage: 35, coinReward: 30, icon: '将' },
}

export function getRecruitCost(batchIndex: number) {
  return Math.min(gameConfig.recruitCostStart + batchIndex * gameConfig.recruitCostStep, gameConfig.recruitCostMax)
}
