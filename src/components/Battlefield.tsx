import { generalConfig } from '../config/gameConfig'
import { canUnlockSlot } from '../game/shovel'
import type { BoardUnit, DragPayload, DuelGameState, GameState, SideId, TroopType } from '../types/game'
import { AttackRangeLayer } from './AttackRangeLayer'
import { DeploymentSlot } from './DeploymentSlot'
import { EnemyLane } from './EnemyLane'
import { HitEffectLayer } from './HitEffectLayer'
import { PathLayer } from './PathLayer'

interface BattlefieldProps {
  state: DuelGameState
  isDragging: boolean
  onDragStart: (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => void
  onSlotClick: (sideId: SideId, slotId: string) => void
  onClearSelection: () => void
}

function unitTroopType(unit: BoardUnit): TroopType {
  return unit.kind === 'troop' ? unit.troopType : generalConfig[unit.generalId].troopType
}

function BattleSideLayer({
  duel,
  side,
  sideId,
  isDragging,
  onDragStart,
  onSlotClick,
}: {
  duel: DuelGameState
  side: GameState
  sideId: SideId
  isDragging: boolean
  onDragStart: (payload: DragPayload, event: React.PointerEvent<HTMLElement>) => void
  onSlotClick: (sideId: SideId, slotId: string) => void
}) {
  const units: Record<string, BoardUnit> = { ...side.troops, ...side.generals }
  const unlockableSlotIds = new Set(
    duel.selectedShovel?.sideId === sideId ? side.slots.filter((slot) => canUnlockSlot(side, slot.id)).map((slot) => slot.id) : [],
  )
  const selectedUnit = duel.selectedSideId === sideId && duel.selectedUnitId ? units[duel.selectedUnitId] : undefined
  const buffedTroopType = selectedUnit?.kind === 'general' ? generalConfig[selectedUnit.generalId].troopType : undefined
  const buffedUnitIds = new Set(
    buffedTroopType
      ? Object.values(units)
          .filter((unit) => unit.kind === 'troop' && unitTroopType(unit) === buffedTroopType)
          .map((unit) => unit.id)
      : [],
  )

  return (
    <>
      <div
        className={`deployment-scene-layer ${sideId === 'ghost' ? 'ghost-deployment-layer' : 'player-deployment-layer'} ${isDragging ? 'is-dragging' : ''}`}
        data-testid={`${sideId}-deployment-scene-layer`}
      >
        {side.slots.map((slot) => (
          <DeploymentSlot
            key={slot.id}
            slot={slot}
            unit={slot.occupantId ? units[slot.occupantId] : undefined}
            isUnlockable={unlockableSlotIds.has(slot.id)}
            isInvalid={side.invalidDropTargetId === slot.id}
            showDps={duel.showDps}
            isSelected={Boolean(slot.occupantId && slot.occupantId === duel.selectedUnitId && duel.selectedSideId === sideId)}
            isBuffed={Boolean(slot.occupantId && buffedUnitIds.has(slot.occupantId))}
            isDraggable={sideId === 'player'}
            onDragStart={onDragStart}
            onSlotClick={(slotId) => onSlotClick(sideId, slotId)}
          />
        ))}
      </div>
      {duel.selectedSideId === sideId && <AttackRangeLayer state={side} units={units} selectedUnitId={duel.selectedUnitId} />}
      {Object.values(side.enemies).map((enemy) => (
        <EnemyLane key={enemy.id} enemy={enemy} showHp={duel.showEnemyHp} />
      ))}
      <HitEffectLayer
        effects={side.hitEffects}
        traces={side.attackTraces}
        coins={side.coinFlyEffects}
        elapsedSeconds={duel.elapsedSeconds}
      />
    </>
  )
}

export function Battlefield({ state, isDragging, onDragStart, onSlotClick, onClearSelection }: BattlefieldProps) {
  return (
    <main className="battlefield duel-battlefield" data-testid="duel-root">
      <div className="lane-field duel-lane-field" aria-label="镜像竞速战场" onClick={onClearSelection}>
        <div className="battle-art art-gate-glow" />
        <div className="battle-art art-banner-left" />
        <div className="battle-art art-banner-right" />
        <div className="battle-art art-smoke-left" />
        <div className="battle-art art-smoke-right" />
        <div className="duel-half ghost-half" data-testid="ghost-half" />
        <div className="duel-half player-half" data-testid="player-half" />
        <div className="duel-axis" aria-hidden="true" />
        <PathLayer />
        <BattleSideLayer
          duel={state}
          side={state.ghost}
          sideId="ghost"
          isDragging={false}
          onDragStart={onDragStart}
          onSlotClick={onSlotClick}
        />
        <BattleSideLayer
          duel={state}
          side={state.player}
          sideId="player"
          isDragging={isDragging}
          onDragStart={onDragStart}
          onSlotClick={onSlotClick}
        />
        <div className="merge-marker" aria-hidden="true" />
      </div>
    </main>
  )
}
