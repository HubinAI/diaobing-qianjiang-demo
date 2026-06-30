import { gameConfig } from '../config/gameConfig'
import type { Star, TroopType } from '../types/game'

export function canMergeTroops(a: { troopType: TroopType; star: Star }, b: { troopType: TroopType; star: Star }) {
  return a.troopType === b.troopType && a.star === b.star && a.star < gameConfig.maxTroopStar
}

export function nextStar(star: Star): Star {
  return Math.min(gameConfig.maxTroopStar, star + 1) as Star
}
