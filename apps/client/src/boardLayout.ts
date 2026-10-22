/** Radius is the distance from centre, measured as a percentage of the square table. */
export const PLAYER_RING_RADIUS = 39;
export const MONSTER_RING_RADIUS = 22;

/** Position a token on a ring around the centre of the entire square board. */
export function radialPosition(index: number, total: number, radiusPercent: number) {
  const angle = (-90 + (360 / Math.max(1, total)) * index) * Math.PI / 180;
  return {
    left: `${50 + Math.cos(angle) * radiusPercent}%`,
    top: `${50 + Math.sin(angle) * radiusPercent}%`,
    transform: 'translate(-50%, -50%)'
  };
}
