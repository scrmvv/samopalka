import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { HERO_DICE } from '@samopalka/shared';
import { FOES } from '../src/foes.js';
import { ARTIFACTS } from '../src/artifacts.js';

type Internal = {combatants:Map<string,{kind:string;hp:number;maxHp:number;alive:boolean}>;rewardOffers:unknown[]};
function camp(beforeRest?:(battle:BattleSession)=>void){
  let clock=1_000;
  const dice=[4,6];let diceIndex=0;
  const battle=new BattleSession([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}],()=>clock,()=>dice[diceIndex++%dice.length]!,()=>0);
  const intern=battle as unknown as Internal;
  beforeRest?.(battle);
  for(const enemy of intern.combatants.values())if(enemy.kind!=='hero'){enemy.alive=false;enemy.hp=0;}
  intern.combatants.get('a')!.hp=1;
  intern.combatants.get('b')!.hp=1;
  battle.pass('a','Воин');
  assert.equal(battle.snapshot().phase,'rest');
  return {battle,intern,advance(ms:number){clock+=ms;return battle.tick(()=>true,id=>id);},now(){return clock;}};
}

test('3.4.2: personal d6 roll heals 2+die, one roll per participant, no auto heal',()=>{
  const {battle,intern}=camp();
  assert.equal(intern.combatants.get('a')!.hp,1);
  assert.equal(intern.combatants.get('b')!.hp,1);
  assert.deepEqual(battle.snapshot().campRest?.pendingPlayerIds,['a','b']);
  assert.equal(battle.snapshot().rewardDraft,null);
  assert.throws(()=>battle.claimReward('a','maxhp'),/броски|бросок|выбирать награду/);
  battle.rollCamp('a');
  assert.equal(intern.combatants.get('a')!.hp,7);
  assert.equal(intern.combatants.get('b')!.hp,1);
  assert.deepEqual(battle.snapshot().campRest?.results.map(x=>[x.playerId,x.die,x.healed]),[['a',4,6]]);
  assert.throws(()=>battle.rollCamp('a'),/уже сделан|недоступен/);
  assert.equal(battle.snapshot().deadlineAt,null);
  battle.rollCamp('b');
  assert.equal(intern.combatants.get('b')!.hp,9);
  assert.equal(battle.snapshot().campRest?.completed,true);
  assert.equal(battle.snapshot().rewardDraft?.offers.length,4);
  assert.equal(battle.snapshot().deadlineAt,61_000);
  assert.throws(()=>battle.rollCamp('b'),/уже сделан|недоступен/);
});

test('3.4.2: camp healing is capped and dead heroes revive on their own roll',()=>{
  const {battle,intern}=camp();
  const warrior=intern.combatants.get('a')!;
  const healer=intern.combatants.get('b')!;
  warrior.hp=warrior.maxHp-1;
  healer.hp=0;healer.alive=false;
  battle.rollCamp('a');
  assert.equal(warrior.hp,warrior.maxHp);
  assert.equal(battle.snapshot().campRest?.results[0]?.healed,1);
  battle.rollCamp('b');
  assert.equal(healer.alive,true);
  assert.equal(healer.hp,8);
});

test('3.4.2: reward 60-second timeout does not replace a dice face',()=>{
  const {battle,advance,intern}=camp();
  battle.rollCamp('a');battle.rollCamp('b');
  const initial=battle.snapshot();
  const picker=initial.rewardDraft!.playerId!;
  const before=initial.diceFaces![picker]!.map(f=>f.label);
  const maxHp=intern.combatants.get(picker)!.maxHp;
  advance(59_999);
  assert.equal(battle.snapshot().rewardDraft?.chosenIds.length,0);
  advance(1);
  assert.equal(intern.combatants.get(picker)?.maxHp,maxHp+2);
  assert.deepEqual(battle.snapshot().diceFaces?.[picker]?.map(f=>f.label),before);
  const draft=battle.snapshot().rewardDraft!;
  assert.deepEqual(draft.chosenIds,[picker]);
  assert.equal(draft.playerId,picker==='a'?'b':'a');
  assert.equal(battle.snapshot().deadlineAt,121_000);
  assert.ok(battle.snapshot().events.some(e=>e.kind==='timeout'&&e.text.includes('60 секунд')));
  advance(60_000);
  assert.equal(battle.snapshot().rewardDraft?.completed,true);
  assert.equal(battle.snapshot().deadlineAt,null);
  battle.continueFloor();
  assert.equal(battle.snapshot().floor,2);
});

test('3.4.2: stale reward action cannot beat server timer',()=>{
  const {battle,advance}=camp();
  battle.rollCamp('a');battle.rollCamp('b');
  const picker=battle.snapshot().rewardDraft!.playerId!;
  advance(60_000); // tick auto-claims already
  assert.throws(()=>battle.claimReward(picker,'maxhp'),/другой игрок/);
});

test('3.4.2: face artifact requires an explicit 0..5 selection and retains other face changes',()=>{
  const {battle,intern}=camp(b=>{
    b.debugSetFace({playerId:'a',index:0,word:'strike',value:9});
    b.debugSetFace({playerId:'a',index:1,word:'shield',value:7});
  });
  battle.rollCamp('a');battle.rollCamp('b');
  const card=ARTIFACTS.find(a=>a.tier===1 && a.kind==='face')!;
  assert.ok(card);
  intern.rewardOffers=[card];
  assert.throws(()=>battle.claimReward('a',card.id),/Выберите грань/);
  assert.throws(()=>battle.claimReward('a',card.id,6),/Выберите грань/);
  assert.equal(battle.snapshot().diceFaces?.a?.[0]?.value,9);
  battle.claimReward('a',card.id,1);
  assert.equal(battle.snapshot().diceFaces?.a?.[0]?.value,9);
  assert.equal(battle.snapshot().diceFaces?.a?.[1]?.label,card.face?.label);
  assert.equal(battle.snapshot().inventories?.a?.[0]?.faceIndex,1);
  battle.claimReward('b','maxhp');
  battle.continueFloor();
  assert.equal(battle.snapshot().diceFaces?.a?.[0]?.value,9);
});

test('3.4.2: personal rest roll is authorized by the room socket identity',()=>{
  const mgr=new RoomManager();
  const {code,playerId}=mgr.create({nickname:'Host',name:'Артефакты',maxPlayers:2,token:'abcdefghijklmnop1'},'h');
  mgr.join({code,nickname:'Guest',token:'abcdefghijklmnop2'},'g');
  mgr.chooseHero('h','warrior');mgr.chooseHero('g','healer');
  mgr.setReady('h',true);mgr.setReady('g',true);mgr.start('h');
  const intern=(mgr as unknown as {rooms:Map<string,{game:BattleSession}>}).rooms.get(code)!.game as unknown as Internal;
  for(const c of intern.combatants.values())if(c.kind!=='hero'){c.alive=false;c.hp=0;}
  mgr.passTurn('h');
  assert.throws(()=>mgr.claimReward('h','maxhp'),/броски/);
  assert.throws(()=>mgr.rollCamp('unknown'),/подключитесь/);
  mgr.rollCamp('g');
  assert.ok(mgr.snapshot(code)?.game?.campRest?.results.some(x=>x.playerId!==playerId));
  assert.throws(()=>mgr.rollCamp('g'),/уже сделан/);
  mgr.rollCamp('h');
  assert.equal(mgr.snapshot(code)?.game?.rewardDraft?.offers.length,4);
});

test('3.4.2: empty starter faces moved to end; meaningful faces at start',()=>{
  for(const [hero,faces] of Object.entries(HERO_DICE)){
    assert.equal(faces.length,6,hero);
    assert.notEqual(faces[0]?.kind,'empty',hero);
    assert.notEqual(faces[1]?.kind,'empty',hero);
    const empties=faces.map((f,i)=>f.kind==='empty'?i:-1).filter(i=>i>=0);
    assert.deepEqual(empties,Array.from({length:empties.length},(_,i)=>6-empties.length+i),hero);
  }
});

test('3.4.2: monster catalog HP, floor, boss flags and specified counts match 4.0',()=>{
  // Compared against uploaded Самопалка 4.0.xlsx, sheet "Монстры", A8:F41.
  const source:[string,number,number,boolean,number|null][]=[
    ['Мясник',1,7,true,1],['Палач',1,6,true,1],['Мертвец',1,4,false,4],['Скелет',1,3,false,4],
    ['Крысинный король',2,7,true,1],['Чумной доктор',2,7,true,1],['Бронезомби',2,5,false,2],['Зомби',2,5,false,2],['Крыса',2,4,false,2],['Миазм',2,1,false,2],
    ['Гвоздеголовый',3,30,true,1],['Рыцарь смерти',3,10,true,1],['Гуль',3,5,false,2],['Проклятый',3,4,false,2],['Туша',3,7,false,2],['Фанатик',3,10,false,2],
    ['Горгона',4,12,true,1],['Призрак',4,8,true,1],['Ведьма',4,4,false,2],['Некромант',4,6,false,2],['Полуденница',4,6,false,2],['Тень',4,1,false,2],
    ['Вампир',5,15,true,1],['Сфинкс',5,15,true,1],['Горгулья',5,4,false,4],['Надгробие',5,3,false,2],['Труповозка',5,5,false,2],['Упырь',5,9,false,4],
    ['Прокаженный',6,25,true,null],['Лич',6,25,true,1],['Трупоед',6,8,false,2],['Гнилец',6,2,false,2],['Еретик',6,10,false,2],['Сектант',6,10,false,2]
  ];
  assert.equal(FOES.length,source.length);
  for(const [name,floor,hp,boss,count] of source){
    const foe=FOES.find(f=>f.name===name&&f.floor===floor);
    assert.ok(foe,`${name}, этаж ${floor}`);
    assert.equal(foe.hp,hp,name);
    assert.equal(foe.boss,boss,name);
    if(count!==null)assert.equal(foe.count,count,name);
  }
});
