import type { BattleSnapshot, CombatantSnapshot, DiceFace } from '@samopalka/shared';
import type { SeededRandom } from './random.js';

export type StrategyId = 'random' | 'aggressive' | 'support' | 'mixed';
export type PlayerAction =
  | { kind: 'roll' }
  | { kind: 'choose'; index: 0 | 1 }
  | { kind: 'target'; id: string }
  | { kind: 'pass' };

export interface AgentContext {
  snapshot: BattleSnapshot;
  playerId: string;
  random: SeededRandom;
}
/** Register a new policy here when new mechanics (artifacts/roles) arrive. */
export interface AgentPolicy {
  readonly id: string;
  decide(context: AgentContext): PlayerAction;
}

const choice = (rng: SeededRandom, n: number) => rng.index(n);
const HP = (entity: CombatantSnapshot) => entity.maxHp ? entity.hp / entity.maxHp : 0;

function scoreFace(face: DiceFace, snapshot: BattleSnapshot, playerId: string, style: StrategyId): number {
  const self = snapshot.combatants.find(c => c.id === playerId);
  if (!self) return -100;
  const wounded = snapshot.combatants.some(c => c.kind === 'hero' && c.alive && HP(c) < 0.6);
  if (style === 'random') return 0;
  switch (face.kind) {
    case 'strike': return (style === 'support' ? 1 : 4) + face.value + (face.label.includes('Дальность') ? 0.5 : 0);
    case 'heal': return (wounded ? 5 + face.value : 0) + (style === 'support' ? 3 : 0);
    case 'shield': return 1 + (style === 'support' ? 2 : 0) + (self.hp < 4 ? face.value : face.value * 0.3);
    case 'mana': return 0.5 + (style === 'support' ? face.value : 0);
    case 'special': return style === 'support' ? 4 : 2;
    default: return -5;
  }
}

export function makePolicy(id: StrategyId): AgentPolicy {
  return {
    id,
    decide({snapshot, playerId, random}): PlayerAction {
      if (snapshot.phase === 'roll') return {kind: 'roll'};
      if (snapshot.phase === 'choose') {
        if (!snapshot.rolls) throw new Error('Choose phase without dice');
        const faces = snapshot.diceFaces?.[playerId];
        if (!faces || faces.length !== 6) throw new Error('Dice faces unavailable');
        const scores = snapshot.rolls.map(faceNum => scoreFace(faces[faceNum - 1]!, snapshot, playerId, id));
        const chosen = scores[0] === scores[1] ? choice(random, 2) : (scores[0]! > scores[1]! ? 0 : 1);
        return {kind:'choose', index:chosen as 0 | 1};
      }
      if (snapshot.phase === 'target') {
        if (!snapshot.availableTargetIds.length) return {kind:'pass'};
        const list = snapshot.availableTargetIds.map(t => snapshot.combatants.find(c => c.id === t)).filter((v): v is CombatantSnapshot => Boolean(v));
        if (!list.length) throw new Error('Targets absent from combatants');
        if (id === 'random') return {kind:'target',id:list[choice(random,list.length)]!.id};
        const action = snapshot.pendingAction;
        // Prefer wounded allies for help, low-health enemies for attacks, and owned monsters over others.
        let ranked = [...list];
        if (action?.kind === 'heal' || action?.kind === 'shield') {
          ranked.sort((a,b) => (a.kind==='hero'?0:1)-(b.kind==='hero'?0:1) || HP(a)-HP(b));
        } else if (action?.kind === 'special' && action.label.includes('Насмешка')) {
          ranked.sort((a,b) => a.hp-b.hp);
        } else {
          const enemyScore=(c:CombatantSnapshot) => c.kind==='monster'?0:c.kind==='boss'?1:2;
          ranked.sort((a,b) => enemyScore(a)-enemyScore(b) || a.hp-b.hp);
        }
        return {kind:'target',id:ranked[0]!.id};
      }
      throw new Error(`Policy invoked in phase ${snapshot.phase}`);
    }
  };
}
