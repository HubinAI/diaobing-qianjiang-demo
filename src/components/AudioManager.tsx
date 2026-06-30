import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types/game'

interface AudioManagerProps {
  state: GameState
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
  return AudioContextClass ? new AudioContextClass() : undefined
}

export function AudioManager({ state }: AudioManagerProps) {
  const [enabled, setEnabled] = useState(true)
  const contextRef = useRef<AudioContext>()
  const previousRef = useRef({
    recruitCount: state.metrics.batchRecruitCount,
    deployCount: state.metrics.deployCount,
    mergeCount: state.metrics.mergeCount,
    totalKills: state.metrics.totalKills,
    shovelUseCount: state.metrics.shovelUseCount,
    guardianHp: state.guardianHp,
    phase: state.phase,
  })

  const ensureContext = () => {
    if (!contextRef.current) contextRef.current = getAudioContext()
    if (contextRef.current?.state === 'suspended') {
      void contextRef.current.resume()
    }
    return contextRef.current
  }

  const playTone = (frequency: number, duration = 0.08, gain = 0.035) => {
    if (!enabled) return
    const context = ensureContext()
    if (!context) return
    const oscillator = context.createOscillator()
    const volume = context.createGain()
    oscillator.frequency.value = frequency
    oscillator.type = 'triangle'
    volume.gain.setValueAtTime(gain, context.currentTime)
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
    oscillator.connect(volume)
    volume.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration)
  }

  useEffect(() => {
    const unlock = () => {
      ensureContext()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    const previous = previousRef.current
    if (state.metrics.batchRecruitCount > previous.recruitCount) playTone(440, 0.09, 0.04)
    if (state.metrics.deployCount > previous.deployCount) playTone(540, 0.07, 0.03)
    if (state.metrics.mergeCount > previous.mergeCount) playTone(720, 0.12, 0.045)
    if (state.metrics.shovelUseCount > previous.shovelUseCount) playTone(320, 0.11, 0.04)
    if (state.metrics.totalKills > previous.totalKills) playTone(620, 0.06, 0.03)
    if (state.guardianHp < previous.guardianHp) playTone(150, 0.12, 0.04)
    if (state.phase !== previous.phase && state.phase === 'won') playTone(880, 0.18, 0.05)
    if (state.phase !== previous.phase && state.phase === 'lost') playTone(120, 0.22, 0.05)
    previousRef.current = {
      recruitCount: state.metrics.batchRecruitCount,
      deployCount: state.metrics.deployCount,
      mergeCount: state.metrics.mergeCount,
      totalKills: state.metrics.totalKills,
      shovelUseCount: state.metrics.shovelUseCount,
      guardianHp: state.guardianHp,
      phase: state.phase,
    }
  }, [enabled, state])

  return (
    <button
      className={`audio-toggle ${enabled ? 'is-on' : ''}`}
      type="button"
      data-testid="audio-toggle"
      onClick={() => {
        ensureContext()
        setEnabled((current) => !current)
      }}
      aria-label={enabled ? '关闭音效' : '开启音效'}
    >
      {enabled ? '音' : '静'}
    </button>
  )
}
