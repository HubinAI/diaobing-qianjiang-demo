import { generalConfig, troopConfig, weaponConfig } from '../config/gameConfig'

interface CompendiumModalProps {
  open: boolean
  onClose: () => void
}

export function CompendiumModal({ open, onClose }: CompendiumModalProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal-panel">
        <button className="modal-close" type="button" onClick={onClose}>
          关闭
        </button>
        <h2>图鉴</h2>
        <h3>兵种</h3>
        <div className="compendium-grid">
          {Object.values(troopConfig).map((item) => (
            <div key={item.label} className="compendium-card">
              <strong>{item.icon}</strong>
              <span>{item.label}兵</span>
              <small>{item.attackStyle}</small>
            </div>
          ))}
        </div>
        <h3>名将与专属武器</h3>
        <div className="compendium-grid">
          {Object.entries(generalConfig).map(([id, item]) => {
            const weapon = weaponConfig[item.weaponId]
            return (
              <div key={id} className="compendium-card">
                <strong>{item.icon}</strong>
                <span>{item.label}</span>
                <small>{weapon.label}</small>
                <small className="combo-effect">{item.comboEffect}</small>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
