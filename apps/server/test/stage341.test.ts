import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { ARTIFACTS } from '../src/artifacts.js';
import { FOES, type FoeDefinition } from '../src/foes.js';
import { addEffect, statusValue } from '../src/effectRules.js';
import type { CombatantSnapshot } from '@samopalka/shared';
import {legacyDiceForCombatFixtures,rollAllAtCamp} from './stage342.helpers.js';

function fixture(players: Array<{id:string;heroId:'knight'|'warrior'|'healer'|'archer'}>=[{id:'a',heroId:'knight'},{id:'b',heroId:'warrior'}],pickIndex=(n:number)=>0){
  let time=1000;
  const battle=new BattleSession(players,()=>time,()=>2,pickIndex);
  legacyDiceForCombatFixtures(battle,players);
  const intern=battle as unknown as {
    actor(id:string):CombatantSnapshot;
    foeDefinitions:Map<string,FoeDefinition>;
    monsterAction(monster:CombatantSnapshot,id:string):void;
    bossPhase():void;
    rewardOffers:unknown[];
    combatants:Map<string,CombatantSnapshot>;
  };
  return {battle,intern,advance:(ms:number)=>{time+=ms;battle.tick(()=>true,id=>id)}};
}

test('3.4.1 taunt can select every living monster, including far heroes',()=>{
  const {battle}=fixture([{id:'a',heroId:'knight'},{id:'b',heroId:'warrior'},{id:'c',heroId:'warrior'},{id:'d',heroId:'warrior'}]);
  battle.debugSetRoll({first:2,second:2});
  battle.choose('a',0,'Рыцарь');
  const choices=battle.snapshot().availableTargetIds;
  assert.ok(choices.includes('monster:1:c'));
  assert.ok(choices.includes('monster:1:d'));
  // Canceling a target selection still returns to the other rolled side.
  battle.cancelChoice('a');
  assert.equal(battle.snapshot().phase,'choose');
  battle.choose('a',1,'Рыцарь');
  battle.target('a','monster:1:c','Рыцарь');
  assert.equal(battle.snapshot().combatants.find(c=>c.id==='monster:1:c')?.ownerId,'a');
});

test('3.4.1 weakness reduces the CURRENT monster strike, expires AFTER its turn',()=>{
  const {intern}=fixture();
  const monster=intern.actor('monster:1:a'),hero=intern.actor('a');
  const skeleton=FOES.find(f=>f.name==='Скелет')!;
  intern.foeDefinitions.set(monster.id,skeleton);
  monster.name=skeleton.name;
  addEffect(monster,'weakness',2);
  const hp=hero.hp;
  intern.monsterAction(monster,'a');
  assert.equal(hero.hp,hp-1,'Удар 3 со Слабостью 2 должен нанести 1');
  assert.equal(statusValue(monster,'weakness'),0,'Слабость исчезает после действия');
});

test('3.4.1 weakness affects boss face too',()=>{
  const {intern}=fixture();
  const boss=intern.actor('boss'),a=intern.actor('a'),b=intern.actor('b');
  const def=FOES.find(f=>f.name==='Палач')!;
  intern.foeDefinitions.set('boss',def);boss.name=def.name;
  addEffect(boss,'weakness',2);
  const before=a.hp+b.hp;
  intern.bossPhase();
  assert.equal(before-(a.hp+b.hp),1);
  assert.equal(statusValue(boss,'weakness'),0);
});

test('3.4.1 poison and regeneration cancel at application, no two badges',()=>{
  const {intern}=fixture();const hero=intern.actor('a');
  addEffect(hero,'poison',3);
  addEffect(hero,'regeneration',2);
  assert.equal(statusValue(hero,'poison'),1);
  assert.equal(statusValue(hero,'regeneration'),0);
  addEffect(hero,'regeneration',5);
  assert.equal(statusValue(hero,'poison'),0);
  assert.equal(statusValue(hero,'regeneration'),4);
});

test('3.4.1 heal and shield may target living monsters',()=>{
  const {battle,intern}=fixture([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}]);
  const monster=intern.actor('monster:1:a');
  monster.hp=1;
  battle.debugSetRoll({first:3,second:3}); // Warrior: Лечение 2
  battle.choose('a',0,'Воин');
  assert.ok(battle.snapshot().availableTargetIds.includes(monster.id));
  battle.target('a',monster.id,'Воин');
  assert.equal(monster.hp,3);
});

test('3.4.1 debug edits to one face survive replacing another with an artifact',()=>{
  const {battle,intern}=fixture([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}]);
  battle.debugSetFace({playerId:'a',index:0,word:'strike',value:9});
  battle.debugSetFace({playerId:'a',index:1,word:'shield',value:7});
  for(const foe of intern.combatants.values())if(foe.kind!=='hero'){foe.hp=0;foe.alive=false;}
  battle.pass('a','Воин');
  assert.equal(battle.snapshot().phase,'rest');
  rollAllAtCamp(battle);
  const picker=battle.snapshot().rewardDraft!.playerId!;
  const card=ARTIFACTS.find(a=>a.kind==='face'&&a.tier===1)!;
  intern.rewardOffers=[card];
  if(picker==='a')battle.claimReward('a',card.id,1);
  else battle.claimReward('b','maxhp');
  if(battle.snapshot().rewardDraft!.playerId==='a'){
    intern.rewardOffers=[card];battle.claimReward('a',card.id,1);
  }else battle.claimReward('b','maxhp');
  battle.continueFloor();
  assert.equal(battle.snapshot().diceFaces!.a![0]!.value,9);
  assert.equal(battle.snapshot().diceFaces!.a![1]!.label,card.face!.label);
});

test('3.4.1 passive HP artifact never occupies a dice face, even with client faceIndex',()=>{
  const {battle,intern}=fixture();
  for(const foe of intern.combatants.values())if(foe.kind!=='hero'){foe.hp=0;foe.alive=false;}
  battle.pass('a','Рыцарь');
  rollAllAtCamp(battle);
  const card=ARTIFACTS.find(a=>a.kind==='hp'||a.kind==='maxhp')!;
  intern.rewardOffers=[card];
  const picker=battle.snapshot().rewardDraft!.playerId!;
  const before=battle.snapshot().diceFaces![picker]!.map(f=>f.label);
  battle.claimReward(picker,card.id,2);
  const item=battle.snapshot().inventories![picker]![0]!;
  assert.equal(item.faceIndex,undefined);
  assert.deepEqual(battle.snapshot().diceFaces![picker]!.map(f=>f.label),before);
});

test('3.4.1 catalog presents uniform term Дальность',()=>{
  assert.ok(!ARTIFACTS.some(a=>[a.title,a.description,a.face?.label].some(s=>s?.includes('Дальнобойность'))));
  assert.ok(!FOES.some(f=>f.description.includes('Дальнобойность')));
});

test('3.4.1 boss random target uses supplied RNG rather than second-player hardcode',()=>{
  const f1=fixture(undefined,()=>0),f2=fixture(undefined,()=>1);
  const def=FOES.find(f=>f.name==='Палач')!;
  for(const f of [f1,f2]){
    f.intern.foeDefinitions.set('boss',def);
    f.intern.actor('boss').name=def.name;
    f.intern.bossPhase();
  }
  assert.ok(f1.intern.actor('a').hp<f1.intern.actor('a').maxHp);
  assert.ok(f2.intern.actor('b').hp<f2.intern.actor('b').maxHp);
});
