import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { FOES, type FoeDefinition } from '../src/foes.js';
import { addEffect, statusValue } from '../src/effectRules.js';
import { monsterGridPositions } from '../../client/src/boardLayout.js';
import type {CombatantSnapshot} from '@samopalka/shared';
import {legacyDiceForCombatFixtures} from './stage342.helpers.js';

function setup(roll:number=5){
  let clock=1000;
  const players=[{id:'knight',heroId:'knight' as const},{id:'warrior',heroId:'warrior' as const}];
  const battle=new BattleSession(players,()=>clock,()=>roll,()=>0);
  legacyDiceForCombatFixtures(battle,players);
  const intern=battle as unknown as {
    actor(id:string):CombatantSnapshot;
    harm(entity:CombatantSnapshot,amount:number,label:string,opts?:{strikeWord?:boolean,poison?:boolean}):number;
    attackByEnemy(enemy:CombatantSnapshot,target:CombatantSnapshot):void;
    foeDefinitions:Map<string,FoeDefinition>;
    prepareTurn():void;
  };
  return {battle,intern,advance:(ms:number)=>{clock+=ms;battle.tick(()=>true,id=>id);}};
}

test('Сон: слово Удар пробуждает даже если щит полностью поглотил урон',()=>{
  const {intern}=setup();
  const hero=intern.actor('knight');hero.shield=7;addEffect(hero,'sleep',1);
  intern.harm(hero,2,'Атака',{strikeWord:true});
  assert.equal(hero.hp,hero.maxHp);
  assert.equal(hero.shield,5);
  assert.equal(statusValue(hero,'sleep'),0);
});
test('Сон: уклонение тоже не мешает пробуждению при Ударе',()=>{
  const {intern}=setup();const hero=intern.actor('knight');
  addEffect(hero,'sleep',1);addEffect(hero,'dodge',1);
  intern.harm(hero,3,'Скелет',{strikeWord:true});
  assert.equal(hero.hp,hero.maxHp);assert.equal(statusValue(hero,'sleep'),0);
});
test('Сон не снимается от яда или Боли без слова Удар',()=>{
  const {intern}=setup();const hero=intern.actor('knight');
  addEffect(hero,'sleep',1);
  intern.harm(hero,1,'Яд',{poison:true});
  intern.harm(hero,1,'Боль');
  assert.equal(statusValue(hero,'sleep'),1);
});
test('Паралич использует текущую грань, а щит поглощает Боль',()=>{
  const {battle,intern}=setup(6);
  const hero=intern.actor('knight');hero.shield=1;
  addEffect(hero,'paralysis',7); // amount in legacy status must NOT determine pain
  battle.roll('knight','Рыцарь');battle.choose('knight',0,'Рыцарь');
  battle.target('knight','monster:1:knight','Рыцарь');
  assert.equal(hero.hp,11); // face 6: Strike 2, shield blocks 1
  assert.equal(hero.shield,0);
  assert.equal(statusValue(hero,'paralysis'),0);
});
test('Рост усиливает ровно одну грань после удара, другая не меняется',()=>{
  const {battle,intern}=setup(6);
  battle.debugSetFace({playerId:'knight',index:5,word:'growth',value:2});
  battle.roll('knight','Рыцарь');battle.choose('knight',0,'Рыцарь');
  battle.target('knight','monster:1:knight','Рыцарь');
  assert.equal(battle.snapshot().diceFaces?.knight?.[5]?.value,3);
  assert.equal(battle.snapshot().diceFaces?.knight?.[4]?.value,3);
  intern.prepareTurn();
  battle.roll('knight','Рыцарь');battle.choose('knight',0,'Рыцарь');
  battle.target('knight','monster:1:warrior','Рыцарь');
  assert.equal(battle.snapshot().diceFaces?.knight?.[5]?.value,4);
});
test('Гниение уменьшает использованную грань до 0, ниже не уходит',()=>{
  const {battle,intern}=setup(6);
  battle.debugSetFace({playerId:'knight',index:5,word:'decay',value:2});
  for(let use=0;use<4;use++){
    if(use)intern.prepareTurn();
    battle.roll('knight','Рыцарь');battle.choose('knight',0,'Рыцарь');
    if(battle.snapshot().phase==='target')battle.target('knight','monster:1:warrior','Рыцарь');
    assert.equal(battle.snapshot().diceFaces?.knight?.[5]?.value,Math.max(0,1-use));
  }
  assert.equal(battle.snapshot().diceFaces?.knight?.[4]?.value,3);
});
test('Гниение монстра ослабляет собственную способность, не грань героя',()=>{
  const {battle,intern}=setup();
  const monster=intern.actor('monster:1:knight'),hero=intern.actor('knight');
  const base=FOES.find(f=>f.name==='Мертвец')!;
  intern.foeDefinitions.set(monster.id,{...base,description:'"Удар, Гниение, 2"'});
  intern.attackByEnemy(monster,hero);intern.attackByEnemy(monster,hero);intern.attackByEnemy(monster,hero);
  assert.equal(hero.hp,9); // exactly 2 + 1 + 0; knight starts at 12, so 9
  assert.equal(battle.snapshot().diceFaces?.knight?.[5]?.value,2);
});
test('монстров и босса можно исследовать по исходным описаниям',()=>{
  const {battle}=setup();
  const state=battle.snapshot();
  assert.ok(state.foeInfo?.boss?.description.includes('Удар'));
  assert.ok(state.foeInfo?.['monster:1:knight']?.description.includes('Удар'));
});
test('каждый монстр действует отдельно через 2 секунды',()=>{
  const {battle,intern,advance}=setup(2);
  const captured=intern.actor('monster:1:warrior');captured.ownerId='knight';
  battle.roll('knight','Рыцарь');battle.choose('knight',0,'Рыцарь');
  if(battle.snapshot().phase==='target')battle.target('knight',captured.id,'Рыцарь');
  const before=intern.actor('knight').hp;
  advance(1999);assert.equal(intern.actor('knight').hp,before);
  advance(1);const afterOne=intern.actor('knight').hp;
  assert.ok(afterOne<before);
  advance(1999);assert.equal(intern.actor('knight').hp,afterOne);
  advance(1);assert.ok(intern.actor('knight').hp<afterOne);
});
test('отдельные ячейки рядом с владельцем при 2–6 участниках и Насмешке',()=>{
  for(const n of [2,3,4,5,6]){
    const ids=Array.from({length:n},(_,i)=>`p${i}`);
    const monsters=[{ownerId:ids[0]!},{ownerId:ids[0]!},{ownerId:ids[0]!},...ids.slice(1).map(ownerId=>({ownerId}))];
    const pos=monsterGridPositions(monsters,ids);
    assert.equal(pos.length,monsters.length);
    for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){
      const a=pos[i]!,b=pos[j]!;
      const d=Math.hypot(parseFloat(a.left)-parseFloat(b.left),parseFloat(a.top)-parseFloat(b.top));
      assert.ok(d>=10,`overlap n=${n}: ${i} / ${j} (${d})`);
    }
  }
});
