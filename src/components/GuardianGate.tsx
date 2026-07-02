import { gameConfig } from '../config/gameConfig'
import type { DuelGameState } from '../types/game'

interface GuardianGateProps {
  state: DuelGameState
}

function hpPercent(hp: number) {
  return Math.max(0, (hp / gameConfig.guardianMaxHp) * 100)
}

/** 根据战况选择貂蝉情绪状态 */
function getDiaochanMood(hpPercent: number, phase: string, waveIndex: number, totalWaves: number): {
  mood: 'cheer' | 'worry' | 'panic' | 'celebrate' | 'idle'
  bubble: string
} {
  // 胜利庆祝
  if (phase === 'won') {
    return { mood: 'celebrate', bubble: '将军威武！' }
  }
  // 失败沮丧
  if (phase === 'lost') {
    return { mood: 'panic', bubble: '呜呜...貂蝉尽力了...' }
  }
  // 危急
  if (hpPercent <= 20) {
    return { mood: 'panic', bubble: '将军！城门危急！' }
  }
  // 危险
  if (hpPercent <= 40) {
    return { mood: 'worry', bubble: '小心敌军！' }
  }
  // Boss波鼓励
  if (waveIndex === totalWaves) {
    return { mood: 'cheer', bubble: '最后一波！加油！' }
  }
  // 满血鼓励
  if (hpPercent >= 90) {
    return { mood: 'cheer', bubble: '将军好厉害！' }
  }
  // 默认
  return { mood: 'idle', bubble: '' }
}

export function GuardianGate({ state }: GuardianGateProps) {
  const playerHp = hpPercent(state.player.guardianHp)
  const isCritical = playerHp <= 20
  const isDanger = playerHp <= 40 && playerHp > 20
  const totalWaves = state.player.waveTable.length
  const { mood, bubble } = getDiaochanMood(playerHp, state.phase, state.player.waveIndex, totalWaves)

  return (
    <section
      className={`city-gate ${isCritical ? 'is-critical' : isDanger ? 'is-danger' : ''}`}
      aria-label="我方貂蝉状态"
      data-testid="player-guardian-zone"
    >
      {/* 城墙背景 + 貂蝉立绘 + 血条融合 */}
      <div className="gate-wall">
        {/* 城门楼屋顶 + 血量百分比 */}
        <div className="gate-roof">
          <div className="gate-roof-top">
            <span className="diaochan-hp-badge" data-testid="player-guardian-hp">{Math.ceil(playerHp)}%</span>
          </div>
          <div className="gate-roof-eaves" />
        </div>
        {/* 城墙主体 */}
        <div className="gate-tower">
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
          <div className="gate-brick-row" />
        </div>
        {/* 城门拱洞 + 貂蝉Q版形象 */}
        <div className="gate-arch">
          <div className="gate-arch-inner">
            {/* 貂蝉Q版人物 + 情绪气泡 */}
            <div
              className={`diaochan-figure mood-${mood} ${isCritical ? 'is-critical' : isDanger ? 'is-danger' : ''}`}
              data-testid="diaochan-avatar"
            >
              {/* 情绪气泡 */}
              {bubble && (
                <div className="diaochan-bubble">
                  <span>{bubble}</span>
                </div>
              )}
              {/* 头顶血条 */}
              <div className="diaochan-hp-bar">
                <div className="diaochan-hp-track">
                  <div
                    className={`diaochan-hp-fill ${isCritical ? 'hp-critical' : isDanger ? 'hp-danger' : ''}`}
                    style={{ width: `${playerHp}%` }}
                  />
                </div>
              </div>
              {/* Q版貂蝉形象 */}
              <div className="diaochan-chibi">
                {/* 头部：Q版大头 */}
                <div className="chibi-head">
                  <div className="chibi-hair-back" />
                  <div className="chibi-face">
                    {/* 眼睛：根据情绪变化 */}
                    <div className={`chibi-eyes mood-${mood}`}>
                      <div className="eye-left" />
                      <div className="eye-right" />
                    </div>
                    {/* 嘴巴 */}
                    <div className={`chibi-mouth mood-${mood}`} />
                    {/* 腮红 */}
                    <div className="chibi-blush" />
                  </div>
                  <div className="chibi-hair-front" />
                  {/* 发饰 */}
                  <div className="chibi-hair-ornament" />
                </div>
                {/* 身体：Q版小身体 */}
                <div className="chibi-body">
                  <div className="chibi-neck" />
                  <div className="chibi-collar" />
                  <div className="chibi-dress" />
                  <div className="chibi-sash" />
                  <div className="chibi-sleeves" />
                  {/* 手臂：根据情绪变化姿势 */}
                  <div className={`chibi-arms mood-${mood}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
