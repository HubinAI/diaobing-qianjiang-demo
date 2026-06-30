import easy from './samples/easy-001.json'
import hard from './samples/hard-001.json'
import normal from './samples/normal-001.json'
import type { GhostDifficulty, GhostRunFile } from './ghostTypes'
import { isGhostRunFileCompatible } from './ghostValidator'

const files = [easy, normal, hard] as GhostRunFile[]

export function getGhostFiles() {
  return files
}

export function getCompatibleGhostFiles() {
  return files.filter(isGhostRunFileCompatible)
}

export function getGhostFileByDifficulty(difficulty: GhostDifficulty = 'normal'): GhostRunFile {
  return (
    getCompatibleGhostFiles().find((file) => file.difficulty === difficulty) ??
    getCompatibleGhostFiles()[0] ??
    files[0]
  )
}

export function getGhostFileById(fileId: string): GhostRunFile {
  return getCompatibleGhostFiles().find((file) => file.ghostId === fileId) ?? getGhostFileByDifficulty('normal')
}
