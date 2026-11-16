import { HERO_DICE, type HeroId, type DiceFace } from '@samopalka/shared';
import type { BattleSession } from '../src/battle.js';

/** Old combat tests target face effects, not the physical order printed on a die.
 * Keep their original scenario mapping and test the NEW dice order separately.
 */
export function legacyDiceForCombatFixtures(session:BattleSession, players:{id:string;heroId:HeroId}[]){
  const intern=session as unknown as {artifactFaces:Map<string,DiceFace[]>};
  for(const player of players){
    const faces=HERO_DICE[player.heroId];
    intern.artifactFaces.set(player.id,[...faces.filter(f=>f.kind==='empty'),...faces.filter(f=>f.kind!=='empty')].map(f=>({...f})));
  }
}
export function rollAllAtCamp(session:BattleSession){
  const pending=session.snapshot().campRest?.pendingPlayerIds??[];
  for(const id of pending)session.rollCamp(id);
}
