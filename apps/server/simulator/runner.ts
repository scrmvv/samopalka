import { HEROES, type BattleSnapshot, type HeroId } from '@samopalka/shared';
import { BattleSession } from '../src/battle.js';
import { checkInvariants, type Invariant } from './invariants.js';
import { makePolicy, type AgentPolicy, type PlayerAction, type StrategyId } from './policies.js';
import { SeededRandom } from './random.js';
import { CombatAnalytics, type GameAnalytics } from './analytics.js';
import { makeScenario, type SimulationMode } from './scenarios.js';

export type SimulationOptions = {
  seed: number;
  players: number;
  maxSteps?: number;
  strategy?: StrategyId;
  mode?: SimulationMode;
  policies?: readonly AgentPolicy[];
  checks?: readonly Invariant[];
  trace?: boolean;
  /** Optional targeted integration scenario; future artifacts and roles can register here. */
  scenario?: SimulationScenario;
};
export interface SimulationScenario {
  readonly id: string;
  onStart?(battle: BattleSession): void;
  beforeStep?(battle: BattleSession, snapshot: BattleSnapshot): void;
  afterStep?(battle: BattleSession, snapshot: BattleSnapshot): void;
}

export type SimulationStep = {
  step: number;
  time: number;
  floor: number;
  round: number;
  phase: BattleSnapshot['phase'];
  actor: string | null;
  action: string;
  resultPhase: BattleSnapshot['phase'];
  newEvents: string[];
};
export type SimulationResult = {
  seed: number;
  players: number;
  strategy: string;
  mode: SimulationMode;
  scenario: string | null;
  completed: boolean;
  outcome: string;
  steps: number;
  highestFloor: number;
  errors: string[];
  analytics: GameAnalytics;
  trace: SimulationStep[];
  /** Always keep the last 25 steps on errors, even when --trace is disabled. */
  recentSteps: SimulationStep[];
  lastEvents: string[];
};

/** Same BattleSession as production; fast virtual time and seeded RNG.
 * The only special test changes are explicitly opt-in via `mode`/`scenario`.
 */
export function simulate(options: SimulationOptions): SimulationResult {
  const {seed,players}=options;
  if(!Number.isInteger(players)||players<2||players>6) throw new Error('players must be 2..6');
  if(!Number.isSafeInteger(seed)) throw new Error('seed must be a safe integer');
  const maxSteps=options.maxSteps??6000;
  if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>100000) throw new Error('maxSteps must be 1..100000');
  const strategy=options.strategy??'mixed';
  const mode=options.mode??'standard';
  if(!['standard','campaign-smoke'].includes(mode))throw new Error(`Unknown simulation mode ${mode}`);
  const engineRng=new SeededRandom(seed);
  const botRng=new SeededRandom(seed ^ 0x6c8e9cf5);
  let now=1_000_000;
  const heroes=Array.from({length:players},(_,i)=>({id:`sim-player-${i+1}`,heroId:HEROES[((i+seed%HEROES.length)+HEROES.length)%HEROES.length]!.id as HeroId}));
  const collector=new CombatAnalytics(heroes);
  const scenario=options.scenario??makeScenario(mode);
  const result:SimulationResult={seed,players,strategy,mode,scenario:scenario?.id??null,completed:false,outcome:'not_started',steps:0,highestFloor:1,errors:[],analytics:collector.data,trace:[],recentSteps:[],lastEvents:[]};
  let battle:BattleSession;
  try {
    battle=new BattleSession(heroes,()=>now,()=>engineRng.die(),n=>engineRng.index(n),collector.event);
    collector.observe(battle.snapshot(),0);
  }catch(error){
    result.errors.push(`Constructor: ${String(error)}`);result.outcome='error';return result;
  }
  const policies=options.policies??heroes.map((_,i)=>makePolicy(strategy==='mixed'?(['aggressive','support','random'] as const)[i%3]!:strategy));
  if(policies.length!==players)throw new Error('policies length must equal player count');
  try {
    scenario?.onStart?.(battle);
    collector.observe(battle.snapshot(),0);
  }catch(error){result.errors.push(`Scenario setup: ${String(error)}`);result.outcome='scenario_error';return result;}
  let lastEventId=0;
  let lastState:BattleSnapshot | undefined;
  for(let step=0;step<maxSteps;step++){
    let state=battle.snapshot();
    try { scenario?.beforeStep?.(battle,state);state=battle.snapshot();collector.observe(state,step); }
    catch(error){result.errors.push(`Scenario beforeStep ${step}: ${String(error)}`);result.outcome='scenario_error';break;}
    lastState=state;
    result.highestFloor=Math.max(result.highestFloor,state.floor);
    result.steps=step;
    const issues=checkInvariants(state,options.checks);
    if(issues.length){result.errors.push(...issues.map(i=>`step ${step}: ${i}`));result.outcome='invariant_failure';break;}
    if(state.phase==='finished'){result.completed=true;result.outcome=state.result?.reason??'unknown';collector.finish(state);break;}
    const actor=state.activePlayerId;
    let action='';
    try {
      switch(state.phase){
        case 'rest':{
          if(state.campRest?.pendingPlayerIds.length){
            const player=state.campRest.pendingPlayerIds[botRng.index(state.campRest.pendingPlayerIds.length)]!;
            battle.rollCamp(player);action=`campRoll:${player}`;break;
          }
          const reward=state.rewardDraft;
          if(reward?.playerId){
            // Select a real catalog artifact, mostly face replacements; test gear across floors.
            const offer=reward.offers[botRng.index(reward.offers.length)];
            if(offer){battle.claimReward(reward.playerId,offer.id,botRng.index(6));action=`reward:${offer.id}`;}
            else {battle.claimReward(reward.playerId,'maxhp');action='reward:maxhp';}
          }else{battle.continueFloor();action='continueFloor';}
          break;
        }
        case 'enemy':
          now=Math.max(now+1,state.deadlineAt??now+500)+1;
          battle.tick(()=>true,id=>id);
          action='tickEnemy';break;
        case 'spell':{
          // Existing simulator policies were written before spell actions. Complete
          // the optional spell window deterministically instead of stalling it.
          if(!actor)throw new Error('Missing active player');
          battle.pass(actor,actor);action='endSpellPhase';break;
        }
        case 'roll':case 'choose':case 'target':{
          if(!actor)throw new Error('Missing active player');
          const idx=heroes.findIndex(h=>h.id===actor);
          if(idx<0)throw new Error(`Unknown actor ${actor}`);
          const decision=policies[idx]!.decide({snapshot:state,playerId:actor,random:botRng});
          action=JSON.stringify(decision);
          collector.decide(state,actor,decision);
          play(battle,actor,decision);
          break;
        }
        case 'paused':throw new Error('Unexpected paused game with connected test players');
        default:throw new Error(`Unhandled phase: ${state.phase}`);
      }
      let after=battle.snapshot();
      scenario?.afterStep?.(battle,after);
      after=battle.snapshot();
      collector.observe(after,step+1);
      // Logs are intentionally capped by the engine; never parse them to calculate damage.
      const events=after.events.filter(ev=>ev.id>lastEventId);
      if(events.length)lastEventId=events.at(-1)!.id;
      const current:SimulationStep={step,time:now,floor:state.floor,round:state.round,phase:state.phase,actor,action,resultPhase:after.phase,newEvents:events.map(ev=>ev.text)};
      if(options.trace)result.trace.push(current);
      result.recentSteps.push(current);
      if(result.recentSteps.length>25)result.recentSteps.shift();
      result.lastEvents=after.events.slice(-15).map(ev=>ev.text);
      result.steps=step+1;
    }catch(error){
      result.errors.push(`step ${step} / floor ${state.floor} / phase ${state.phase} / actor ${actor} / ${action}: ${error instanceof Error?error.stack??error.message:String(error)}`);
      result.outcome='exception';break;
    }
  }
  if(!result.completed&&!result.errors.length){
    result.errors.push(`Step limit reached (${maxSteps}); last phase: ${lastState?.phase}`);
    result.outcome='step_limit';
  }
  // Repro steps are always available for failed games, but not stored in summary for every success.
  return result;
}

function play(battle:BattleSession,id:string,action:PlayerAction){
  switch(action.kind){
    case 'roll':battle.roll(id,id);break;
    case 'choose':battle.choose(id,action.index,id);break;
    case 'target':{
      const state=battle.snapshot();
      const label=state.pendingAction?.label.toLocaleLowerCase('ru-RU')??'';
      const scatterIds=label.includes('разброс')?(state.scatterCandidates?.[action.id]??[]).slice(0,2):[];
      const selected=[action.id,...scatterIds];
      const cleanseSelections:Record<string,Record<string,number>>={};
      if(label.includes('очищение'))for(const targetId of selected){
        const effects=state.combatants.find(c=>c.id===targetId)?.effects??[];
        let remaining=state.pendingAction?.value??0;
        const choices:Record<string,number>={};
        for(const effect of effects){
          if(!['poison','weakness','sleep','paralysis','stun','decay'].includes(effect.kind))continue;
          const count=Math.min(remaining,effect.amount);
          if(count>0){choices[effect.kind]=count;remaining-=count;}
        }
        cleanseSelections[targetId]=choices;
      }
      battle.target(id,label.includes('разброс')||label.includes('очищение')
        ?{targetId:action.id,...(label.includes('разброс')?{scatterIds}:{}),...(label.includes('очищение')?{cleanseSelections}:{})}:action.id,id);
      break;
    }
    case 'pass':battle.pass(id,id);break;
  }
}
