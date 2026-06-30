import { duelConfig } from '../config/gameConfig'
import type { GhostRunFile } from './ghostTypes'

export const supportedGhostSchemaVersion = 1

export function validateGhostRunFile(file: GhostRunFile): string[] {
  const errors: string[] = []
  if (file.schemaVersion !== supportedGhostSchemaVersion) errors.push('schemaVersion')
  if (file.rulesetVersion !== duelConfig.rulesetVersion) errors.push('rulesetVersion')
  if (file.configHash !== duelConfig.configHash) errors.push('configHash')
  if (!Array.isArray(file.actions)) errors.push('actions')
  return errors
}

export function isGhostRunFileCompatible(file: GhostRunFile) {
  return validateGhostRunFile(file).length === 0
}
