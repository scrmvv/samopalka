/** Radius is the distance from centre, measured as a percentage of the square table. */
export const PLAYER_RING_RADIUS = 38.5;
export const MONSTER_RING_RADIUS = 21;

/** Position a token on a ring around the centre of the entire square board. */
export function radialPosition(index: number, total: number, radiusPercent: number) {
  const angle = (-90 + (360 / Math.max(1, total)) * index) * Math.PI / 180;
  return {
    left: `${50 + Math.cos(angle) * radiusPercent}%`,
    top: `${50 + Math.sin(angle) * radiusPercent}%`,
    transform: 'translate(-50%, -50%)'
  };
}

/**
 * A defeated monster stays in the server's battle history, but must not
 * participate in the on-screen layout (or intercept target selection).
 * Keep each survivor's original index for stable sprite variants.
 */
export function visibleMonsters<T extends {kind: string; alive: boolean}>(combatants: readonly T[]): T[] {
  return combatants.filter(combatant => combatant.kind === 'monster' && combatant.alive);
}


/**
 * Position live monsters around the same circle without stacking them when
 * «Насмешка» transfers another monster to one hero. Each owner gets a sector;
 * repeated owners are fanned out, with enough angular separation to click.
 */
export function monsterRingPositions<T extends {ownerId: string | null}>(
  monsters: readonly T[], playerIds: readonly string[], radiusPercent = MONSTER_RING_RADIUS
) {
  const positions: ReturnType<typeof radialPosition>[] = [];
  if (!monsters.length) return positions;
  const ownerIndices = monsters.map(m => playerIds.indexOf(m.ownerId ?? ''));
  const hasRepeat = ownerIndices.some((owner, i) => owner >= 0 && ownerIndices.indexOf(owner) !== i);
  if (!hasRepeat) return monsters.map((_, i) => radialPosition(ownerIndices[i]! >= 0 ? ownerIndices[i]! : i, playerIds.length, radiusPercent));

  // Sort by seating position; this keeps a claimed monster near its new owner
  // while preventing the old and new monsters from sharing identical coordinates.
  const indices = monsters.map((_, i) => i).sort((a,b) => {
    const ao = ownerIndices[a]! < 0 ? playerIds.length : ownerIndices[a]!;
    const bo = ownerIndices[b]! < 0 ? playerIds.length : ownerIndices[b]!;
    return ao-bo || a-b;
  });
  const step = 360 / monsters.length;
  const startOptions: number[] = [];
  for (const owner of [...new Set(ownerIndices.filter(n => n >= 0))]) {
    const slots = indices.map((id, idx) => ownerIndices[id] === owner ? idx : -1).filter(v => v >= 0);
    const slotMid=(slots[0]!+slots[slots.length-1]!)/2;
    const desiredAngle=-90 + 360*owner/playerIds.length;
    startOptions.push(desiredAngle - step*slotMid);
  }
  const start = startOptions.length ? startOptions.reduce((sum,n)=>sum+n,0)/startOptions.length : -90;
  const wideRadius = Math.min(29, Math.max(radiusPercent, monsters.length > 5 ? 25 : 24));
  for (let rank=0; rank<indices.length; rank++) {
    const angle=(start+rank*step)*Math.PI/180;
    positions[indices[rank]!] = {
      left:`${50+Math.cos(angle)*wideRadius}%`,top:`${50+Math.sin(angle)*wideRadius}%`,
      transform:'translate(-50%, -50%)'
    };
  }
  return positions;
}
