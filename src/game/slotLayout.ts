import type { SideId } from '../types/game'

export const slotLayoutVersion = 3

const legacyBaseSlotIdMap: Record<string, string> = {
  'left-active-0': 'left-active-0',
  'left-active-1': 'left-active-1',
  'left-active-2': 'left-active-2',
  'left-active-3': 'left-active-3',
  'left-active-4': 'left-active-4',
  'left-locked-0': 'left-locked-0',
  'left-locked-1': 'left-locked-1',
  'left-aux-active-0': 'left-aux-active-0',
  'left-aux-locked-0': 'left-aux-locked-0',
  'left-aux-locked-1': 'left-aux-locked-1',
  'center-active-0': 'center-active-0',
  'center-locked-0': 'center-locked-0',
  'right-active-0': 'right-active-0',
  'right-active-1': 'right-active-1',
  'right-active-2': 'right-active-2',
  'right-active-3': 'right-active-3',
  'right-active-4': 'right-active-4',
  'right-locked-0': 'right-locked-0',
  'right-locked-1': 'right-locked-1',
  'right-aux-active-0': 'right-aux-active-0',
  'right-aux-locked-0': 'right-aux-locked-0',
  'right-aux-locked-1': 'right-aux-locked-1',
}

export function mapLegacySlotId(slotId: string): string | undefined {
  const match = /^(player|ghost)-(.+)$/.exec(slotId)
  if (!match) return legacyBaseSlotIdMap[slotId]

  const sideId = match[1] as SideId
  const baseId = match[2]
  const mapped = legacyBaseSlotIdMap[baseId] ?? baseId
  return mapped ? `${sideId}-${mapped}` : undefined
}
