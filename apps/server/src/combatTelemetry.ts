/** Optional, structured combat observations. The production game never needs a subscriber.
 * Every new mechanic should emit structured events from the SAME rule implementation,
 * rather than making the simulator infer combat from localized log messages.
 */
export type CombatTelemetryEvent =
  | { type: 'damage'; floor: number; sourceId: string | null; targetId: string; targetKind: 'hero' | 'monster' | 'boss'; targetName: string; label: string; attempted: number; applied: number; shieldAbsorbed: number; damageType: 'poison' | 'strike'; dodged: boolean; killed: boolean }
  | { type: 'heal'; floor: number; sourceId: string | null; targetId: string; targetKind: 'hero' | 'monster' | 'boss'; amount: number }
  | { type: 'status'; floor: number; sourceId: string | null; targetId: string; status: string; amount: number };

export type CombatTelemetryListener = (event: CombatTelemetryEvent) => void;
