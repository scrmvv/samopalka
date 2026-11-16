import { HEROES, type BattleSnapshot, type HeroId } from '@samopalka/shared';
import type { CombatTelemetryEvent } from '../src/combatTelemetry.js';
import type { PlayerAction } from './policies.js';

export type HeroAnalytics = {
  heroId: HeroId; name: string; damageDealt: number; damageTaken: number;
  healingDone: number; healingReceived: number; shieldAbsorbed: number;
  kills: number; deaths: number; turns: number; wins: number; survived: number; healingEvents: number; chosenActions: Record<string,number>;
};
export type FoeAnalytics = {
  encounters: number; damageToHeroes: number; damageTaken: number;
  heroKills: number; defeated: number;
};
export type FirstHeroDeath = { step: number; floor: number; round: number; heroId: HeroId; cause: string; attacker: string | null };
export type GameAnalytics = {
  damageToHeroes: number; damageToEnemies: number; healingToHeroes: number;
  shieldAbsorbed: number; poisonDamage: number; heroDeaths: number;
  firstHeroDeath: FirstHeroDeath | null;
  byHero: Record<string, HeroAnalytics>;
  byFoe: Record<string, FoeAnalytics>;
  statusesApplied: Record<string,number>;
};
const newFoe = ():FoeAnalytics => ({encounters:0,damageToHeroes:0,damageTaken:0,heroKills:0,defeated:0});
const makeHero = (id:HeroId):HeroAnalytics => ({
  heroId:id,name:HEROES.find(h=>h.id===id)?.name??id,
  damageDealt:0,damageTaken:0,healingDone:0,healingReceived:0,
  shieldAbsorbed:0,kills:0,deaths:0,turns:0,wins:0,survived:0,healingEvents:0,chosenActions:{}
});

/** Test-only collector for structured events emitted by the real combat engine.
 * No localized journal parsing and no re-implementation of damage mechanics.
 */
export class CombatAnalytics {
  readonly data:GameAnalytics;
  private readonly heroIds:Record<string,HeroId>;
  private readonly seenFoes = new Set<string>();
  private foeNames=new Map<string,string>();
  private floor=1;
  private round=1;
  private step=0;
  constructor(players:readonly {id:string;heroId:HeroId}[]){
    this.heroIds=Object.fromEntries(players.map(p=>[p.id,p.heroId]));
    this.data={damageToHeroes:0,damageToEnemies:0,healingToHeroes:0,shieldAbsorbed:0,poisonDamage:0,heroDeaths:0,
      firstHeroDeath:null,byHero:Object.fromEntries(players.map(p=>[p.id,makeHero(p.heroId)])),byFoe:{},statusesApplied:{}};
  }
  observe(state:BattleSnapshot,step:number){
    this.floor=state.floor;this.round=state.round;this.step=step;
    for(const entity of state.combatants){
      if(entity.kind==='hero')continue;
      this.foeNames.set(entity.id,entity.name);
      const key=`${state.floor}:${entity.id}`;
      if(!this.seenFoes.has(key)){
        this.seenFoes.add(key);
        (this.data.byFoe[entity.name]??=newFoe()).encounters++;
      }
    }
  }
  decide(state:BattleSnapshot,id:string,action:PlayerAction){
    const hero=this.data.byHero[id];
    if(!hero)return;
    if(action.kind==='roll')hero.turns++;
    if(action.kind==='choose' && state.rolls){
      const faceIndex=state.rolls[action.index]-1;
      const face=state.diceFaces?.[id]?.[faceIndex];
      const key=face?.label??face?.kind??'unknown';
      hero.chosenActions[key]=(hero.chosenActions[key]??0)+1;
    }
  }
  finish(state:BattleSnapshot){
    for(const entity of state.combatants){
      const hero=this.data.byHero[entity.id];if(!hero)continue;
      if(entity.alive)hero.survived=1;
      if(state.result?.winnerIds.includes(entity.id))hero.wins=1;
    }
  }
  event=(event:CombatTelemetryEvent):void=>{
    const sourceHero=event.sourceId?this.data.byHero[event.sourceId]:undefined;
    if(event.type==='status'){
      this.data.statusesApplied[event.status]=(this.data.statusesApplied[event.status]??0)+1;
      return;
    }
    if(event.type==='heal'){
      if(sourceHero){
        sourceHero.healingDone+=event.amount;
        if(event.amount>0)sourceHero.healingEvents++;
      }
      if(event.targetKind==='hero'){
        this.data.healingToHeroes+=event.amount;
        const hero=this.data.byHero[event.targetId];if(hero)hero.healingReceived+=event.amount;
      }
      return;
    }
    this.data.shieldAbsorbed+=event.shieldAbsorbed;
    if(event.damageType==='poison')this.data.poisonDamage+=event.applied;
    if(sourceHero && event.targetKind!=='hero')sourceHero.damageDealt+=event.applied;
    if(event.targetKind==='hero'){
      this.data.damageToHeroes+=event.applied;
      const hero=this.data.byHero[event.targetId];
      if(hero){hero.damageTaken+=event.applied;hero.shieldAbsorbed+=event.shieldAbsorbed;}
      if(event.sourceId && !sourceHero){
        const foeName=this.foeNames.get(event.sourceId);
        if(foeName)(this.data.byFoe[foeName]??=newFoe()).damageToHeroes+=event.applied;
      }
      if(event.killed){
        this.data.heroDeaths++;
        if(hero)hero.deaths++;
        let cause='unknown';
        if(event.damageType==='poison')cause='poison';
        else if(!event.sourceId)cause='environment';
        else if(sourceHero)cause='hero';
        else if(event.sourceId==='boss')cause='boss';
        else if(this.foeNames.has(event.sourceId))cause='monster';
        if(!this.data.firstHeroDeath && hero)this.data.firstHeroDeath={step:this.step,floor:this.floor,round:this.round,heroId:hero.heroId,cause,attacker:event.sourceId?this.foeNames.get(event.sourceId)??event.sourceId:null};
        if(event.sourceId && !sourceHero){
          const foeName=this.foeNames.get(event.sourceId);
          if(foeName)(this.data.byFoe[foeName]??=newFoe()).heroKills++;
        }
      }
    }else{
      this.data.damageToEnemies+=event.applied;
      (this.data.byFoe[event.targetName]??=newFoe()).damageTaken+=event.applied;
      if(event.killed){
        (this.data.byFoe[event.targetName]??=newFoe()).defeated++;
        if(sourceHero)sourceHero.kills++;
      }
    }
  };
}

/** Compact batch aggregation: memory proportional to number of foe/class types, not games. */
export class AnalyticsAggregate {
  total={damageToHeroes:0,damageToEnemies:0,healingToHeroes:0,shieldAbsorbed:0,poisonDamage:0,heroDeaths:0,firstDeathCount:0,firstDeathStepSum:0};
  byClass:Record<string,HeroAnalytics & {appearances:number}>={};
  byFoe:Record<string,FoeAnalytics>={};
  statusesApplied:Record<string,number>={};
  firstDeathCauses:Record<string,number>={};
  firstDeathFloors:Record<string,number>={};
  add(data:GameAnalytics){
    for(const key of ['damageToHeroes','damageToEnemies','healingToHeroes','shieldAbsorbed','poisonDamage','heroDeaths'] as const)this.total[key]+=data[key];
    if(data.firstHeroDeath){
      this.total.firstDeathCount++;this.total.firstDeathStepSum+=data.firstHeroDeath.step;
      const cause=data.firstHeroDeath.cause;
      this.firstDeathCauses[cause]=(this.firstDeathCauses[cause]??0)+1;
      const floor=String(data.firstHeroDeath.floor);this.firstDeathFloors[floor]=(this.firstDeathFloors[floor]??0)+1;
    }
    for(const hero of Object.values(data.byHero)){
      const item=this.byClass[hero.heroId]??={...makeHero(hero.heroId),appearances:0};
      item.appearances++;
      for(const key of ['damageDealt','damageTaken','healingDone','healingReceived','shieldAbsorbed','kills','deaths','turns','wins','survived','healingEvents'] as const)item[key]+=hero[key];
      for(const [label,count] of Object.entries(hero.chosenActions))item.chosenActions[label]=(item.chosenActions[label]??0)+count;
    }
    for(const [name,foe] of Object.entries(data.byFoe)){
      const item=this.byFoe[name]??=newFoe();
      for(const key of ['encounters','damageToHeroes','damageTaken','heroKills','defeated'] as const)item[key]+=foe[key];
    }
    for(const [name,value] of Object.entries(data.statusesApplied))this.statusesApplied[name]=(this.statusesApplied[name]??0)+value;
  }
  report(games:number){
    const avg=(v:number)=>Math.round(v/games*100)/100;
    return {
      totals:this.total,
      perGame:{damageToHeroes:avg(this.total.damageToHeroes),damageToEnemies:avg(this.total.damageToEnemies),healingToHeroes:avg(this.total.healingToHeroes),shieldAbsorbed:avg(this.total.shieldAbsorbed),poisonDamage:avg(this.total.poisonDamage),heroDeaths:avg(this.total.heroDeaths)},
      firstHeroDeath:{count:this.total.firstDeathCount,averageStep:this.total.firstDeathCount?Math.round(this.total.firstDeathStepSum/this.total.firstDeathCount):null,causes:this.firstDeathCauses,floors:this.firstDeathFloors},
      classes:Object.fromEntries(Object.entries(this.byClass).map(([id,x])=>[id,{...x,averageDamageDealt:x.appearances?Math.round(x.damageDealt/x.appearances*100)/100:0,averageDamageTaken:x.appearances?Math.round(x.damageTaken/x.appearances*100)/100:0,winRate:x.appearances?Math.round(x.wins/x.appearances*10000)/100:0}])),
      foes:Object.fromEntries(Object.entries(this.byFoe).sort((a,b)=>b[1].heroKills-a[1].heroKills||b[1].damageToHeroes-a[1].damageToHeroes)),
      statusesApplied:this.statusesApplied
    };
  }
}
