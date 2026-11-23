import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession, BattleError } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { FOES } from '../src/foes.js';
import { ARTIFACTS } from '../src/artifacts.js';
import { addEffect, statusValue } from '../src/effectRules.js';
import { monsterGridPositions } from '../../client/src/boardLayout.js';
import type { CombatantSnapshot, DiceFace } from '@samopalka/shared';

function fixture(count=2) {
  const roster=[{id:'a',heroId:'warrior' as const,nickname:'Alice'},{id:'b',heroId:'healer' as const,nickname:'Bob'},
    {id:'c',heroId:'archer' as const,nickname:'Charlie'},{id:'d',heroId:'knight' as const,nickname:'Dora'}].slice(0,count);
  const battle=new BattleSession(roster,()=>1000,()=>1,()=>0);
  const intern=battle as unknown as {
    combatants:Map<string,CombatantSnapshot>;
    artifactFaces:Map<string,DiceFace[]>;
    petrifiedFaces:Map<string,Set<number>>;
    foeDefinitions:Map<string,(typeof FOES)[number]>;
    attackByEnemy(enemy:CombatantSnapshot,target:CombatantSnapshot):void;
    harm(target:CombatantSnapshot,amount:number,label:string,options?:{poison?:boolean,sourceId?:string,faceIndex?:number,strikeWord?:boolean}):number;
  };
  const hero=(id:string)=>intern.combatants.get(id)!;
  const custom=(id:string,face:DiceFace)=>{const faces=battle.snapshot().diceFaces![id]!;faces[0]=face;intern.artifactFaces.set(id,faces);};
  const action=()=>{battle.debugSetRoll({first:1,second:1});battle.choose('a',0,'Alice');};
  return {battle,intern,hero,custom,action};
}

test('customer #1: combination Heal + Mana awards mana to owner, not target',()=>{
  const {battle,hero,custom,action}=fixture();
  custom('a',{kind:'heal',value:2,label:'Лечение, Мана, 2'});
  hero('b').hp=5;
  action();battle.target('a','b','Alice');
  assert.equal(hero('a').mana,2);
  assert.equal(hero('b').mana,0);
  assert.equal(hero('b').hp,7);
});

test('customer #1: combination Strike + Mana also goes only to owner',()=>{
  const {battle,hero,custom,action}=fixture();
  custom('a',{kind:'strike',value:2,label:'Удар, Мана, 2'});
  const enemy=hero('monster:1:a');const hp=enemy.hp;
  action();battle.target('a',enemy.id,'Alice');
  assert.equal(hero('a').mana,2);
  assert.equal(hero('b').mana,0);
  assert.equal(enemy.hp,Math.max(0,hp-2));
});

test('customer #1: combination Shield + Mana also awards mana to caster',()=>{
  const {battle,hero,custom,action}=fixture();
  custom('a',{kind:'shield',value:2,label:'Щит, Мана, 2'});
  action();battle.target('a','b','Alice');
  assert.equal(hero('a').mana,2);
  assert.equal(hero('b').mana,0);
  assert.equal(hero('b').shield,2);
});

test('customer #2: scatter rejects auto selection and lets the actor pick exact neighbors',()=>{
  const {battle,hero,custom,action}=fixture(4);
  custom('a',{kind:'strike',value:1,label:'Удар, Разброс, 1'});
  action();
  const main='monster:1:a';
  const available=battle.snapshot().scatterCandidates?.[main]??[];
  assert.equal(available.length,2);
  assert.throws(()=>battle.target('a',main,'Alice'),/сосед/);
  assert.throws(()=>battle.target('a',{targetId:main,scatterIds:[main,main]},'Alice'),/сосед/);
  const original=[main,...available].map(id=>hero(id).hp);
  battle.target('a',{targetId:main,scatterIds:available},'Alice');
  [main,...available].forEach((id,i)=>assert.equal(hero(id).hp,original[i]!-1));
});

test('customer #2: scatter works with no neighbors, applying only main target',()=>{
  const {battle,hero,custom,action,intern}=fixture();
  custom('a',{kind:'strike',value:1,label:'Удар, Разброс, 1'});
  for(const entry of intern.combatants.values()) if(entry.kind==='monster'&&entry.ownerId==='b')entry.alive=false;
  action();
  const main='monster:1:a';
  assert.deepEqual(battle.snapshot().scatterCandidates?.[main],[]);
  const hp=hero(main).hp;
  battle.target('a',{targetId:main,scatterIds:[]},'Alice');
  assert.equal(hero(main).hp,hp-1);
});

test('customer #4/16: cleanse subtracts selected negative strength, preserves petrification',()=>{
  const {battle,hero,custom,action,intern}=fixture();
  custom('a',{kind:'heal',value:2,label:'Лечение, Очищение, 2'});
  addEffect(hero('b'),'poison',2);
  addEffect(hero('b'),'weakness',1);
  intern.petrifiedFaces.set('b',new Set([4]));
  action();
  assert.throws(()=>battle.target('a','b','Alice'),/очищ/);
  assert.throws(()=>battle.target('a',{targetId:'b',cleanseSelections:{b:{petrified:2}}},'Alice'),/распределени/);
  battle.target('a',{targetId:'b',cleanseSelections:{b:{poison:2}}},'Alice');
  assert.equal(statusValue(hero('b'),'poison'),0);
  assert.equal(statusValue(hero('b'),'weakness'),1);
  assert.ok(intern.petrifiedFaces.get('b')?.has(4));
  assert.equal(battle.snapshot().combatants.find(x=>x.id==='b')!.effects?.some(x=>x.kind==='petrified'),true);
});

test('customer #16: petrification disappears on hero death and is not cleared by regular cleanse',()=>{
  const {intern,hero,battle}=fixture();
  intern.petrifiedFaces.set('b',new Set([0,1]));
  const snapshot=battle.snapshot();
  assert.ok(snapshot.combatants.find(x=>x.id==='b')?.effects?.some(x=>x.kind==='petrified'));
  intern.harm(hero('b'),hero('b').hp,'Удар',{strikeWord:true});
  assert.equal(hero('b').alive,false);
  assert.equal(intern.petrifiedFaces.has('b'),false);
  assert.ok(!battle.snapshot().combatants.find(x=>x.id==='b')?.effects?.some(x=>x.kind==='petrified'));
});

test('customer #9: full HP relic increases current AND max; empty HP only max',()=>{
  const {battle,hero}=fixture();
  hero('b').hp=4;
  battle.debugGrantArtifact({playerId:'b',artifactId:'art-309'});
  assert.equal(hero('b').hp,6);
  assert.equal(hero('b').maxHp,13);
  battle.debugGrantArtifact({playerId:'b',artifactId:'art-311'});
  assert.equal(hero('b').hp,6);
  assert.equal(hero('b').maxHp,19);
});

test('customer #10: binary statuses do not stack numeric potency',()=>{
  const {hero}=fixture();
  for(const kind of ['stun','sleep','paralysis'] as const) {
    addEffect(hero('a'),kind,12);
    addEffect(hero('a'),kind,20);
    assert.equal(statusValue(hero('a'),kind),1);
  }
});

test('customer #13/14: face labels use effective value with delta and petrification is visible',()=>{
  const {battle,intern,hero}=fixture();
  addEffect(hero('a'),'weakness',1);
  const face=battle.snapshot().diceFaces!.a![2]!;
  assert.equal(face.value,1);
  assert.match(face.label,/1 \(-1\)/);
  intern.petrifiedFaces.set('a',new Set([2]));
  assert.ok(battle.snapshot().combatants.find(x=>x.id==='a')!.effects?.some(x=>x.kind==='petrified'));
});

test('customer #15: debug effect strength may exceed 10 but not 500',()=>{
  const {battle,hero}=fixture();
  battle.debugApplyStatus({id:'a',kind:'poison',mode:'add',amount:27});
  assert.equal(statusValue(hero('a'),'poison'),27);
  assert.throws(()=>battle.debugApplyStatus({id:'a',kind:'poison',mode:'add',amount:501}),BattleError);
});

test('customer #17: monster durability does not reduce poison damage',()=>{
  const {intern,hero}=fixture();
  const foe=FOES.find(f=>f.name==='Горгулья')!;
  const monster=hero('monster:1:a');
  intern.foeDefinitions.set(monster.id,foe);
  monster.name=foe.name;monster.hp=20;monster.maxHp=20;monster.shield=0;
  assert.equal(intern.harm(monster,4,'Яд',{poison:true}),4);
  assert.equal(monster.hp,16);
  assert.equal(intern.harm(monster,4,'Удар',{strikeWord:true}),1);
  assert.equal(monster.hp,15);
});

test('customer #18: Vampire leech increases strike AND self heal',()=>{
  const {intern,hero}=fixture();
  const vamp=FOES.find(f=>f.name==='Вампир')!;
  intern.foeDefinitions.set('boss',vamp);
  const boss=hero('boss');boss.name=vamp.name;boss.maxHp=15;boss.hp=5;
  hero('a').hp=hero('a').maxHp-3;hero('a').shield=0;
  intern.attackByEnemy(boss,hero('a'));
  assert.equal(hero('a').hp,hero('a').maxHp-7); // strike: base 1 + 3 missing = 4
  assert.equal(boss.hp,9); // self healing also 4, not only 1
});

test('customer #5: hero nickname is present in combat event when hit',()=>{
  const {intern,battle,hero}=fixture();
  intern.harm(hero('a'),2,'Зомби',{strikeWord:true});
  assert.ok(battle.snapshot().events.some(e=>e.text.includes('Воин «Alice»')&&e.text.includes('Зомби')));
});

test('customer #8: only lobby host can kick; invalid kick is denied',()=>{
  const notifications:string[]=[];
  const m=new RoomManager(()=>{},()=>1000,(socket,reason)=>notifications.push(`${socket}:${reason}`));
  const {code,playerId}=m.create({nickname:'Host',name:'My room',maxPlayers:3,token:'aaaaaaaaaaaaaaaaa'},'h');
  m.join({code,nickname:'Guest',token:'bbbbbbbbbbbbbbbbb'},'g');
  const guestId=m.snapshot(code)!.players[1]!.id;
  assert.throws(()=>m.kick('g',playerId),/хосту/);
  assert.throws(()=>m.kick('h',playerId),/себя/);
  m.kick('h',guestId);
  assert.equal(m.snapshot(code)!.players.length,1);
  assert.match(notifications.join(),/g:Хост исключил/);
  assert.throws(()=>m.kick('g',guestId),/подключ/);
});

test('customer #12: behind foes appear closer to center than front foes of same owner',()=>{
  const points=monsterGridPositions([{ownerId:'a',behind:false},{ownerId:'a',behind:true}],['a','b'],{width:1100,height:720});
  const y=points.map(p=>Number.parseFloat(p.top));
  assert.ok(y[1]!>y[0]!,`rear foe (${y[1]}) must be closer to center than front foe (${y[0]})`);
});
