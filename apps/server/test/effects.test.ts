import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { FOES, type FoeDefinition } from '../src/foes.js';
import { printedFoeAction, addEffect, statusValue } from '../src/effectRules.js';
import type { CombatantSnapshot, HeroId } from '@samopalka/shared';

function fixture(heroIds:HeroId[]=['warrior','healer'], rolls:number[]=[5,5]){
  let now=1000;let index=0;
  const s=new BattleSession(heroIds.map((heroId,i)=>({id:`p${i}`,heroId})),()=>now,()=>rolls[index++%rolls.length]!,()=>0);
  const intern=s as unknown as {
    actor(id:string):CombatantSnapshot|undefined;
    foeDefinitions:Map<string,FoeDefinition>;
    harm(target:CombatantSnapshot,amount:number,label:string,opts?:{poison?:boolean,sourceId?:string,faceIndex?:number}):number;
    attackByEnemy(enemy:CombatantSnapshot,target:CombatantSnapshot):void;
    bossPhase():void;
    monsterPhase(id:string):void;
    summon(ownerId:string,tier:number,label:string):void;
    prepareTurn(first?:boolean):void;
    completeAction(id:string):void;
  };
  const find=(name:string)=>FOES.find(f=>f.name===name)!;
  const hero=(i=0)=>intern.actor(`p${i}`)!;
  const monster=(i=0)=>intern.actor(`monster:1:p${i}`)!;
  function setFoe(id:string,name:string){
    const def=find(name);intern.foeDefinitions.set(id,def);
    const c=intern.actor(id)!;c.name=name;c.hp=def.hp;c.maxHp=def.hp;c.alive=true;c.effects=[];return c;
  }
  function act(playerId='p0',target?:string){
    s.roll(playerId,playerId);s.choose(playerId,0,playerId);
    if(s.snapshot().phase==='target')s.target(playerId,target!,playerId);
  }
  return {s,intern,find,hero,monster,setFoe,act,advance:(ms:number)=>now+=ms};
}

test('описания монстров: реальные числа и составные слова вместо тестового урона',()=>{
  const f=fixture();
  assert.equal(printedFoeAction(f.find('Палач')).amount,3);
  assert.equal(printedFoeAction(f.find('Мясник')).scatter,true);
  assert.equal(printedFoeAction(f.find('Крыса')).poison,true);
  assert.equal(printedFoeAction(f.find('Чумной доктор')).allHeroes,true);
  assert.equal(printedFoeAction(f.find('Надгробие')).strike,false);
});

test('яд проходит сквозь щит и наносит урон в конце хода',()=>{
  const {s,hero}=fixture();
  const c=hero();c.shield=5;addEffect(c,'poison',2);
  s.pass('p0','p0');
  assert.equal(hero().hp,9);
  assert.equal(hero().shield,5);
  assert.equal(statusValue(hero(),'poison'),2);
});

test('яд и регенерация уменьшают действие друг друга',()=>{
  const {s,hero}=fixture();
  const c=hero();c.hp=6;addEffect(c,'poison',2);addEffect(c,'regeneration',1);
  s.pass('p0','p0');
  assert.equal(c.hp,5);
});

test('уворот отменяет удар целиком и расходуется',()=>{
  const {intern,hero}=fixture();
  const c=hero();addEffect(c,'dodge',1);
  assert.equal(intern.harm(c,4,'враг'),0);
  assert.equal(c.hp,11);
  assert.equal(statusValue(c,'dodge'),0);
  assert.equal(intern.harm(c,2,'враг'),2);
});

test('Берсерк: СамоУворот 1 поглощает первый ответный удар',()=>{
  const {s,advance,hero}=fixture(['berserker','healer'],[3,3]);
  s.roll('p0','p0');s.choose('p0',0,'p0');
  assert.equal(s.snapshot().phase,'enemy');
  assert.equal(statusValue(hero(),'dodge'),1);
  advance(500);s.tick(()=>true,id=>id);
  assert.equal(hero().hp,8);
  assert.equal(statusValue(hero(),'dodge'),0);
});

test('Рыцарь: Самощит и Насмешка переводят монстра к владельцу',()=>{
  const {s,hero,monster}=fixture(['knight','healer'],[2,2]);
  s.roll('p0','p0');s.choose('p0',0,'p0');
  const second=monster(1).id;
  assert.ok(s.snapshot().availableTargetIds.includes(second));
  s.target('p0',second,'p0');
  assert.equal(hero().shield,1);
  assert.equal(monster(1).ownerId,'p0');
});

test('Лучник: дальность позволяет выбирать босса и дальних противников',()=>{
  const {s,monster}=fixture(['archer','warrior','warrior','warrior'],[4,4]);
  s.roll('p0','p0');s.choose('p0',0,'p0');
  assert.ok(s.snapshot().availableTargetIds.includes('boss'));
  assert.ok(s.snapshot().availableTargetIds.includes(monster(2).id));
});

test('броня снижает только урон, не отравление',()=>{
  const {intern,setFoe}=fixture();
  const target=setFoe('monster:1:p0','Бронезомби');
  intern.harm(target,2,'удар');
  assert.equal(target.hp,4);
  intern.harm(target,2,'яд',{poison:true});
  assert.equal(target.hp,2);
});

test('прочность ограничивает любой ненулевой удар до единицы урона',()=>{
  const {intern,setFoe}=fixture();
  const target=setFoe('monster:1:p0','Горгулья');
  intern.harm(target,20,'удар');
  assert.equal(target.hp,3);
});

test('бесплотность пропускает только один удар до собственного следующего хода',()=>{
  const {intern,setFoe}=fixture();
  const target=setFoe('boss','Призрак');
  intern.harm(target,2,'удар');
  intern.harm(target,2,'удар');
  assert.equal(target.hp,6);
  // Each boss action clears the per-turn hit gate.
  intern.bossPhase();
  intern.harm(target,2,'удар');
  assert.equal(target.hp,4);
});

test('Слабость уменьшает стороны героев и снимается в конце их хода',()=>{
  const {s,hero}=fixture(['warrior','healer'],[5,5]);
  addEffect(hero(),'weakness',1);
  assert.equal(s.snapshot().diceFaces?.p0?.[4].value,1);
  s.roll('p0','p0');s.choose('p0',0,'p0');
  s.target('p0','monster:1:p0','p0');
  assert.equal(statusValue(hero(),'weakness'),0);
});

test('Сон блокирует ход, пока герой не получит настоящий урон',()=>{
  const {intern,hero,advance,s}=fixture();
  addEffect(hero(1),'sleep',1);
  s.pass('p0','p0');advance(500);s.tick(()=>true,id=>id);
  assert.equal(s.activePlayer(),'p1');
  assert.equal(s.snapshot().phase,'enemy');
  intern.harm(hero(1),1,'враг');
  assert.equal(statusValue(hero(1),'sleep'),0);
});

test('Паралич наносит боль при выборе следующей стороны и снимается после хода',()=>{
  const {s,hero}=fixture(['warrior','healer'],[5,5]);
  addEffect(hero(),'paralysis',2);
  s.roll('p0','p0');s.choose('p0',0,'p0');s.target('p0','monster:1:p0','p0');
  assert.equal(hero().hp,9);
  assert.equal(statusValue(hero(),'paralysis'),0);
});

test('Гниение уменьшает использованную грань на один после каждого применения',()=>{
  const {s,hero}=fixture(['warrior','healer'],[5,5]);
  addEffect(hero(),'decay',1);
  s.roll('p0','p0');s.choose('p0',0,'p0');s.target('p0','monster:1:p0','p0');
  assert.equal(s.snapshot().diceFaces?.p0?.[4].value,1);
});

test('Мясник с Разбросом задевает обоих соседних героев',()=>{
  const {intern,hero,setFoe}=fixture(['warrior','healer','adept']);
  setFoe('boss','Мясник');
  intern.bossPhase();
  for(let i=0;i<3;i++)assert.equal(hero(i).hp,hero(i).maxHp-1);
});

test('монстр с ядом накладывает отрицательный эффект после удара',()=>{
  const {intern,hero,setFoe}=fixture();
  const rat=setFoe('monster:1:p0','Крыса');
  intern.attackByEnemy(rat,hero());
  assert.equal(hero().hp,10);
  assert.equal(statusValue(hero(),'poison'),1);
});

test('надгробие призывает монстра, не нанося выдуманный базовый удар',()=>{
  const {intern,hero,setFoe,s}=fixture();
  const gravestone=setFoe('monster:1:p0','Надгробие');
  intern.monsterPhase('p0');
  assert.equal(hero().hp,11);
  assert.ok(s.snapshot().combatants.filter(c=>c.kind==='monster'&&c.ownerId==='p0').length>1);
  assert.equal(gravestone.alive,true);
});

test('лих призывает противников из 4 этажа, когда впервые теряет половину здоровья',()=>{
  const {intern,setFoe,s}=fixture();
  const lich=setFoe('boss','Лич');
  const before=s.snapshot().combatants.length;
  intern.harm(lich,13,'удар');
  assert.ok(s.snapshot().combatants.length>before);
  const after=s.snapshot().combatants.length;
  intern.harm(lich,1,'удар');
  assert.equal(s.snapshot().combatants.length,after);
});

test('палач наносит 3 единицы, а не упрощённую единицу урона',()=>{
  const {intern,hero,setFoe}=fixture();
  setFoe('boss','Палач');intern.bossPhase();
  assert.equal(hero().hp,8);
});

test('Миазм наносит массовый удар с ядом и погибает после собственной атаки',()=>{
  const {intern,hero,setFoe}=fixture();
  const miasm=setFoe('monster:1:p0','Миазм');
  intern.attackByEnemy(miasm,hero());
  assert.equal(hero(0).hp,10);
  assert.equal(hero(1).hp,10);
  assert.equal(statusValue(hero(0),'poison'),1);
  assert.equal(statusValue(hero(1),'poison'),1);
  assert.equal(miasm.alive,false);
});

test('яд действует в конце пропущенного из-за сна хода',()=>{
  const {s,intern,hero}=fixture();
  const c=hero(0);c.hp=8;
  addEffect(c,'sleep',1);addEffect(c,'poison',1);
  intern.prepareTurn();
  assert.equal(s.snapshot().phase,'enemy');
  assert.equal(c.hp,7);
  assert.equal(statusValue(c,'sleep'),0); // poison damage wakes the hero
});

test('Насмешка: сначала выдаёт Самощит, затем вражеский удар расходует щит, остаток повреждает героя',()=>{
  const {s,hero,monster,setFoe,advance}=fixture(['knight','healer'],[2,2]);
  // Two skeletons: knight already has one, then taunts the other.
  setFoe(monster(0).id,'Скелет');
  setFoe(monster(1).id,'Скелет');
  s.roll('p0','p0');s.choose('p0',0,'p0');
  s.target('p0',monster(1).id,'p0');
  assert.equal(hero().shield,1);
  assert.equal(hero().hp,12);
  assert.equal(monster(1).ownerId,'p0');
  advance(500);s.tick(()=>true,id=>id);
  assert.equal(hero().shield,0);
  assert.equal(hero().hp,7); // 2 hits × 3, shield blocks one point.
  assert.ok(s.snapshot().events.some(e=>e.text.includes('Самощит +1')));
  assert.ok(s.snapshot().events.some(e=>e.text.includes('щит поглотил 1')));
});
