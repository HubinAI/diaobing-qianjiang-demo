import { enemyPaths, pathPointsAttribute } from '../game/paths'

export function PathLayer() {
  return (
    <svg className="path-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {Object.values(enemyPaths).map((path) => (
        <polyline
          key={path.id}
          className={`path-stroke path-${path.id}`}
          points={pathPointsAttribute(path.id)}
          data-testid={`path-${path.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`}
          data-path-id={path.id}
        />
      ))}
    </svg>
  )
}
