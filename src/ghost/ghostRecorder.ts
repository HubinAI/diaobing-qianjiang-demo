import type { GhostAction, GhostRunFile } from './ghostTypes'

export class GhostRecorder {
  private readonly actions: GhostAction[] = []

  record(action: GhostAction) {
    this.actions.push(action)
  }

  exportFile(base: Omit<GhostRunFile, 'actions' | 'metrics'>): GhostRunFile {
    return {
      ...base,
      actions: [...this.actions],
      metrics: {
        recruitCount: this.actions.filter((action) => action.type === 'recruit_batch').length,
        deployCount: this.actions.filter((action) => action.type === 'deploy').length,
        mergeCount: this.actions.filter((action) => action.type === 'merge').length,
        unlockCount: this.actions.filter((action) => action.type === 'unlock_slot').length,
        generalCount: this.actions.filter((action) => action.type === 'upgrade_general').length,
        weaponCount: this.actions.filter((action) => action.type === 'equip_weapon').length,
      },
    }
  }
}
