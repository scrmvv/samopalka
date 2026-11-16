import type { BattleSnapshot } from '@samopalka/shared';
import type { BattleSession } from '../src/battle.js';
import type { SimulationScenario } from './runner.js';

export type SimulationMode = 'standard' | 'campaign-smoke';

/** Sim-only smoke test: deliberately modifies stats/dice to check all six floors.
 * NEVER use its results to evaluate real-world difficulty or relative class strength.
 * This does not modify a rule or victory condition inside BattleSession.
 */
export function makeScenario(mode:SimulationMode):SimulationScenario|undefined {
  if(mode==='standard')return undefined;
  let configuredFloor=0;
  let configuredDiceFloor=0;
  function adjust(battle:BattleSession,state:BattleSnapshot){
    // A new floor is configured once; all changes are in this test session only.
    if(!['roll','choose','target','enemy'].includes(state.phase))return;
    if(configuredFloor!==state.floor){
      configuredFloor=state.floor;
      for(const c of state.combatants){
        if(!c.alive)continue;
        if(c.kind==='hero'){
          battle.debugSetStat({id:c.id,field:'maxHp',value:500});
          battle.debugSetStat({id:c.id,field:'hp',value:500});
        }else{
          battle.debugSetStat({id:c.id,field:'maxHp',value:1});
          battle.debugSetStat({id:c.id,field:'hp',value:1});
        }
      }
    }
    // Some floors begin with a stunned hero and jump directly into the enemy phase.
    // Only override dice when the active hero has an unrolled turn.
    if(configuredDiceFloor!==state.floor && state.phase==='roll'){
      configuredDiceFloor=state.floor;
      for(const c of state.combatants.filter(c=>c.kind==='hero'&&c.alive)){
        for(let i=0;i<6;i++)battle.debugSetFace({playerId:c.id,index:i,word:'strike',value:20});
      }
    }
  }
  return {id:mode,onStart(battle){adjust(battle,battle.snapshot());},beforeStep(battle,state){adjust(battle,state);}};
}
