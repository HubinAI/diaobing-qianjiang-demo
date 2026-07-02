import { useEffect, useRef, useState } from 'react'

type MatchPhase = 'rolling' | 'reveal' | 'fly'

interface MatchmakingOverlayProps {
  targetDifficulty: 'easy' | 'normal' | 'hard'
  onComplete: () => void
}

const DIFFICULTIES = [
  { key: 'easy' as const, label: '青铜对手', color: '#cd7f32', icon: '🛡️' },
  { key: 'normal' as const, label: '白银对手', color: '#c0c0c0', icon: '⚔️' },
  { key: 'hard' as const, label: '黄金对手', color: '#ffd700', icon: '👑' },
]

export function MatchmakingOverlay({ targetDifficulty, onComplete }: MatchmakingOverlayProps) {
  const [phase, setPhase] = useState<MatchPhase>('rolling')
  const [rollIndex, setRollIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({})
  const cardRef = useRef<HTMLDivElement>(null)

  // 滚动阶段：快速切换难度名称
  useEffect(() => {
    if (phase !== 'rolling') return
    const speeds = [60, 80, 100, 130, 160, 200, 260, 340, 440]
    let step = 0
    const targetIdx = DIFFICULTIES.findIndex((d) => d.key === targetDifficulty)
    const totalSteps = speeds.length + 1

    const tick = () => {
      if (step < speeds.length) {
        setRollIndex((step + 1) % DIFFICULTIES.length)
        step += 1
        setTimeout(tick, speeds[step - 1])
      } else {
        // 最终停在目标难度上
        setRollIndex(targetIdx)
        setSelectedIndex(targetIdx)
        setPhase('reveal')
      }
    }
    tick()
  }, [phase, targetDifficulty])

  // reveal 阶段：高亮停留后飞走
  useEffect(() => {
    if (phase !== 'reveal') return
    const t = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        // 目标位置：TopHud 左上角（ghost-card 区域）
        const ghostCard = document.querySelector('.ghost-card')
        if (ghostCard) {
          const ghostRect = ghostCard.getBoundingClientRect()
          setFlyStyle({
            '--fly-start-x': `${rect.left + rect.width / 2}px`,
            '--fly-start-y': `${rect.top + rect.height / 2}px`,
            '--fly-end-x': `${ghostRect.left + ghostRect.width / 2}px`,
            '--fly-end-y': `${ghostRect.top + ghostRect.height / 2}px`,
          } as React.CSSProperties)
        }
      }
      setPhase('fly')
    }, 1200)
    return () => clearTimeout(t)
  }, [phase])

  // fly 阶段：缩小飞向目标，完成后回调
  useEffect(() => {
    if (phase !== 'fly') return
    const t = setTimeout(onComplete, 700)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  const currentDifficulty = DIFFICULTIES[rollIndex]
  const isSelected = phase !== 'rolling' && rollIndex === selectedIndex
  const isFlying = phase === 'fly'

  return (
    <div className="matchmaking-overlay">
      <div className="matchmaking-backdrop" />
      <div className="matchmaking-stage">
        {phase === 'rolling' && <p className="matchmaking-label">正在匹配对手…</p>}
        {phase === 'reveal' && <p className="matchmaking-label matchmaking-found">对手已找到！</p>}
        {phase === 'fly' && <p className="matchmaking-label matchmaking-ready">准备迎战！</p>}
        <div
          ref={cardRef}
          className={`matchmaking-card ${isSelected ? 'is-selected' : ''} ${isFlying ? 'is-flying' : ''}`}
          style={{ ...flyStyle, borderColor: isSelected ? currentDifficulty.color : undefined }}
        >
          <span className="matchmaking-icon">{currentDifficulty.icon}</span>
          <strong style={{ color: isSelected ? currentDifficulty.color : undefined }}>
            {currentDifficulty.label}
          </strong>
        </div>
        {isFlying && (
          <div className="matchmaking-fly-ghost" style={flyStyle}>
            <span>{currentDifficulty.icon}</span>
            <strong style={{ color: currentDifficulty.color }}>{currentDifficulty.label}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
