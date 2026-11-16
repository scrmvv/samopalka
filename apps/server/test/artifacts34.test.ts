import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession, BattleError } from '../src/battle.js';
import { ARTIFACTS } from '../src/artifacts.js';
import { RoomManager } from '../src/rooms.js';
import { rollAllAtCamp } from './stage342.helpers.js';

function setup() {
  let now=1000;
  const battle=new BattleSession([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}],()=>now,()=>6,()=>0);
  const state=(battle as unknown as {combatants:Map<string,{kind:string;hp:number;alive:boolean}>}).combatants;
  for(const foe of state.values())if(foe.kind!=='hero'){foe.hp=0;foe.alive=false;}
  battle.pass('a','a');
  assert.equal(battle.snapshot().phase,'rest');
  rollAllAtCamp(battle);
  return {battle,advance(ms:number){now+=ms}};
}
function claimAll(battle:BattleSession,choice:'maxhp'|'faceup'='maxhp',faceIndex=5){
  for(let count=0;count<6;count++){
    const picker=battle.snapshot().rewardDraft?.playerId;
    if(!picker)return;
    battle.claimReward(picker,choice,faceIndex);
  }
  throw new Error('Not all rewards claimed');
}

test('3.4: four real source cards, one choice per turn, replenished after claim',()=>{
  const {battle}=setup();
  const initial=battle.snapshot().rewardDraft!;
  assert.equal(initial.offers.length,4);
  assert.equal(new Set(initial.offers.map(a=>a.id)).size,4);
  assert.ok(initial.offers.every(a=>a.tier===1));
  const current=initial.playerId!;
  const other=current==='a'?'b':'a';
  assert.throws(()=>battle.claimReward(other,initial.offers[0]!.id,0),/другой игрок/);
  assert.throws(()=>battle.continueFloor(),/выбрать награду/);
  assert.throws(()=>battle.claimReward(current,'unknown',0),/нет среди/);
  const first=initial.offers[0]!;
  battle.claimReward(current,first.id,5);
  const following=battle.snapshot().rewardDraft!;
  assert.equal(following.offers.length,4);
  assert.equal(new Set(following.offers.map(a=>a.id)).size,4);
  assert.equal(following.playerId,other);
  assert.ok(!following.offers.some(a=>a.id===first.id));
  assert.throws(()=>battle.claimReward(current,following.offers[0]!.id,0),/другой игрок/);
  battle.claimReward(other,'maxhp');
  assert.equal(battle.snapshot().rewardDraft?.completed,true);
  assert.equal(battle.snapshot().inventories?.[current]?.length,1);
  battle.continueFloor();
  assert.equal(battle.snapshot().floor,2);
  assert.equal(battle.snapshot().inventories?.[current]?.length,1);
  assert.equal(battle.snapshot().diceFaces?.[current]?.[5]?.value,first.face?.value);
});

test('3.4: face +1 and max HP +2 persist on next floor',()=>{
  const {battle}=setup();
  const first=battle.snapshot().rewardDraft!.playerId!;
  const second=first==='a'?'b':'a';
  const oldValue=battle.snapshot().diceFaces?.[first]?.[0]?.value??0;
  const oldHp=battle.snapshot().combatants.find(c=>c.id===second)!.maxHp;
  battle.claimReward(first,'faceup',0);
  battle.claimReward(second,'maxhp');
  battle.continueFloor();
  assert.equal(battle.snapshot().diceFaces?.[first]?.[0]?.value,oldValue+1);
  assert.equal(battle.snapshot().combatants.find(c=>c.id===second)?.maxHp,oldHp+2);
});

test('3.4: cannot choose face artifact without a valid face number',()=>{
  const {battle}=setup();
  const draft=battle.snapshot().rewardDraft!;
  const card=draft.offers.find(a=>a.kind==='face');
  assert.ok(card);
  assert.throws(()=>battle.claimReward(draft.playerId!,card!.id),/Выберите грань/);
  assert.throws(()=>battle.claimReward(draft.playerId!,card!.id,6),/Выберите грань/);
  assert.equal(battle.snapshot().rewardDraft?.playerId,draft.playerId);
});

test('3.4: consumable heals only active owner once',()=>{
  const {battle}=setup();
  const picker=battle.snapshot().rewardDraft!.playerId!;
  const next=picker==='a'?'b':'a';
  const consumable=ARTIFACTS.find(a=>a.kind==='consumable')!;
  assert.ok(consumable);
  // Controlled loot fixture, not a public bypass.
  (battle as unknown as {rewardOffers:unknown[]}).rewardOffers=[consumable];
  battle.claimReward(picker,consumable.id);
  battle.claimReward(next,'maxhp');
  battle.continueFloor();
  const item=battle.snapshot().inventories![picker]![0]!;
  const current=battle.activePlayer()!;
  assert.throws(()=>battle.useArtifact(current===picker?next:current,item.instanceId));
  // Test active owner after reaching their turn; game action order remains authoritative.
  if(current!==picker){
    const snapshot=battle.snapshot();
    const ent=(battle as unknown as {activeIndex:number,playerIds:string[]});
    ent.activeIndex=ent.playerIds.indexOf(picker);
  }
  battle.debugSetStat({id:picker,field:'hp',value:2});
  const old=battle.snapshot().combatants.find(c=>c.id===picker)!.hp;
  battle.useArtifact(picker,item.instanceId);
  assert.equal(battle.snapshot().combatants.find(c=>c.id===picker)?.hp,Math.min(old+5,battle.snapshot().combatants.find(c=>c.id===picker)!.maxHp));
  assert.equal(battle.snapshot().inventories?.[picker]?.[0]?.spent,true);
  assert.throws(()=>battle.useArtifact(picker,item.instanceId),/недоступен/);
});

test('3.4: catalog excludes unknown effects from offer pool and has each tier',()=>{
  const {battle}=setup();
  assert.ok(ARTIFACTS.length>=80);
  for(let tier=1;tier<=5;tier++){
    assert.ok(ARTIFACTS.filter(a=>a.tier===tier).length>=4);
  }
  assert.ok(ARTIFACTS.every(a=>a.kind!=='face'||(a.face&&a.face.value>=0)));
  assert.ok(battle.snapshot().rewardDraft?.offers.every(a=>a.description.length>0));
});
