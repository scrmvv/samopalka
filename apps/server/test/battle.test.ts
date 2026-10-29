import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession, turnDurations } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { FOES } from '../src/foes.js';
import { HERO_DICE, type HeroId } from '@samopalka/shared';

type TestHero = { id: string; heroId: HeroId };
function make(heroes: TestHero[] = [{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}], rolls: number[] = [5,5], pick = () => 0) {
  let now = 1000;
  let dieIndex = 0;
  const session = new BattleSession(heroes, () => now, () => rolls[dieIndex++ % rolls.length]!, pick);
  const monster = (id: string, floor = session.snapshot().floor) => `monster:${floor}:${id}`;
  const entity = (id: string) => session.snapshot().combatants.find(c=>c.id===id);
  const act = (id: string, target?: string) => {
    session.roll(id,id);
    session.choose(id,0,id);
    if (session.snapshot().phase==='target') {
      if (!target) throw Error('Тест: ожидалась цель');
      session.target(id,target,id);
    }
    if (session.snapshot().phase === 'enemy') { now += 500; session.tick(()=>true,id=>id); }
  };
  return {session,entity,act,monster, advance(ms: number) { now+=ms; }, resolveEnemy() { now+=500; session.tick(()=>true,id=>id); }};
}

test('бросок двух кубиков, выбор грани и ответная атака монстра', () => {
  const {session,act,entity,monster} = make();
  assert.equal(session.activePlayer(),'a');
  assert.throws(()=>session.choose('a',0,'a'),/Сначала бросьте/);
  const monsterHp = entity(monster('a'))!.hp;
  act('a',monster('a'));
  assert.equal(entity(monster('a'))?.hp,monsterHp-2);
  assert.equal(entity('a')?.hp,9); // dead man strikes 2, from source monster table
  assert.equal(session.activePlayer(),'b');
  assert.equal(session.snapshot().rolls,null);
  assert.ok(session.snapshot().events.some(e=>e.text.includes('Мертвец')));
});

test('нельзя делать бросок или выбирать за другого', () => {
  const {session} = make();
  assert.throws(()=>session.roll('b','b'),/другого игрока/);
  session.roll('a','a');
  assert.throws(()=>session.choose('b',0,'b'),/другого игрока/);
  assert.throws(()=>session.choose('a',3,'a'),/один из двух/);
});

test('таймаут пропускает ход, враги всё равно атакуют, второй пропуск — кик', () => {
  const {session,advance,entity,resolveEnemy} = make();
  advance(60_000);
  assert.deepEqual(session.tick(()=>true,id=>id),[]);
  resolveEnemy();
  assert.equal(entity('a')?.hp,9);
  assert.equal(session.activePlayer(),'b');
  session.pass('b','b');
  resolveEnemy();
  advance(60_000);
  assert.deepEqual(session.tick(()=>true,id=>id),['a']);
  assert.equal(session.snapshot().missedTurns.a,2);
});

test('переподключение не увеличивает счётчик пропусков', () => {
  const {session,advance,resolveEnemy} = make();
  session.disconnected('a');
  advance(60_000);
  assert.deepEqual(session.tick(id=>id!=='a',id=>id),[]);
  assert.equal(session.snapshot().missedTurns.a??0,0);
  resolveEnemy();
  session.pass('b','b');
  resolveEnemy();
  session.reconnected('a');
  session.roll('a','a');
});

test('после полного круга игроков атакует босс ровно один раз', () => {
  const {session,act,monster,resolveEnemy} = make();
  act('a',monster('a'));
  session.pass('b','b');
  resolveEnemy();
  const bossEvents=session.snapshot().events.filter(e=>e.text.startsWith('Ход босса'));
  assert.equal(bossEvents.length,1);
  assert.equal(session.snapshot().round,2);
});

test('босс не ходит между двумя героями одного круга', () => {
  const {session,act,monster} = make();
  act('a',monster('a'));
  assert.equal(session.snapshot().events.some(e=>e.text.startsWith('Ход босса')),false);
});

test('щит сначала поглощает урон монстра', () => {
  const {session,act,entity}=make(undefined,[4,4,6,6]);
  act('a','a'); // warrior gets shield 2, monster attacks for 2
  assert.equal(entity('a')?.hp,11);
  assert.equal(entity('a')?.shield,0);
});

test('лечение не может превысить максимальное здоровье', () => {
  const {session,act}=make(undefined,[3,3]);
  act('a','a'); // heal 2 at full hp, then monster attacks
  assert.ok(session.snapshot().events.some(e=>e.text.includes('лечение') && e.text.includes('на 0 здоровья')));
});

test('максимальный запас маны — 3 по таблице правил', () => {
  const {session,act,entity}=make([{id:'a',heroId:'adept'},{id:'b',heroId:'healer'}],[6,6]);
  act('a');
  assert.equal(entity('a')?.mana,3);
  assert.equal(entity('a')?.maxMana,3);
});

test('нельзя атаковать босса, пока перед героем жив свой монстр', () => {
  const {session}=make();
  session.roll('a','a');session.choose('a',0,'a');
  assert.throws(()=>session.target('a','boss','a'),/Недопустимая цель/);
  assert.equal(session.snapshot().phase,'target');
});

test('соседний монстр доступен для базового удара',()=>{
  const {session,monster}=make();
  session.roll('a','a');session.choose('a',0,'a');
  assert.ok(session.snapshot().availableTargetIds.includes(monster('b')));
});

test('все шесть этажей имеют босса и достаточную колоду монстров',()=>{
  for(let floor=1;floor<=6;floor++) {
    const bosses=FOES.filter(f=>f.floor===floor && f.boss);
    const count=FOES.filter(f=>f.floor===floor && !f.boss).reduce((sum,f)=>sum+f.count,0);
    assert.ok(bosses.length>=1);
    assert.ok(count>=6);
  }
});

test('поддерживается 6 игроков, у каждого противник',()=>{
  const heroes:TestHero[]=[{id:'p0',heroId:'warrior'},{id:'p1',heroId:'healer'},{id:'p2',heroId:'adept'},{id:'p3',heroId:'berserker'},{id:'p4',heroId:'knight'},{id:'p5',heroId:'archer'}];
  const {session}=make(heroes);
  assert.equal(session.snapshot().combatants.filter(c=>c.kind==='monster').length,6);
  assert.equal(session.snapshot().combatants.filter(c=>c.kind==='boss').length,1);
});

test('после зачистки этажа открывается привал, новый этаж с обновлённым набором',()=>{
  const {session}=make();
  const state=(session as unknown as {combatants:Map<string,{kind:string;alive:boolean;hp:number}>}).combatants;
  for(const c of state.values()) if(c.kind!=='hero'){c.alive=false;c.hp=0;}
  session.pass('a','a');
  assert.equal(session.snapshot().phase,'rest');
  assert.equal(session.snapshot().floor,1);
  assert.throws(()=>session.roll('a','a'),/нельзя выполнять ход/);
  session.continueFloor();
  assert.equal(session.snapshot().floor,2);
  assert.equal(session.snapshot().phase,'roll');
  assert.ok(session.snapshot().combatants.some(c=>c.kind==='monster' && c.alive));
});

test('после шестого этажа игра заканчивается победой',()=>{
  const {session}=make();
  const state=(session as unknown as {combatants:Map<string,{kind:string;alive:boolean;hp:number}>}).combatants;
  for(let level=1;level<=6;level++){
    for(const c of state.values()) if(c.kind!=='hero'){c.alive=false;c.hp=0;}
    session.pass(session.activePlayer()!, 'player');
    if(level<6) {
      assert.equal(session.snapshot().phase,'rest');
      session.continueFloor();
    }
  }
  assert.equal(session.snapshot().phase,'finished');
  assert.equal(session.snapshot().result?.reason,'six_floors');
  assert.equal(session.snapshot().result?.winnerIds.length,2);
});

test('победа последнего выжившего определяется сервером',()=>{
  const {session,act,entity}=make();
  const state=(session as unknown as {combatants:Map<string,{hp:number}>}).combatants;
  state.get('b')!.hp=1;
  act('a','b');
  assert.equal(entity('b')?.alive,false);
  assert.equal(session.snapshot().phase,'finished');
  assert.deepEqual(session.snapshot().result,{reason:'last_survivor',winnerIds:['a']});
});

test('смерть в отряде из 3 героев переводит монстров к следующему живому',()=>{
  const heroes:TestHero[]=[{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'},{id:'c',heroId:'adept'}];
  const {session,act,entity,monster}=make(heroes);
  const state=(session as unknown as {combatants:Map<string,{hp:number}>}).combatants;
  state.get('b')!.hp=1;
  act('a','b');
  assert.equal(entity('b')?.alive,false);
  assert.equal(entity(monster('b'))?.ownerId,'c');
  assert.equal(session.snapshot().phase,'roll');
});

test('выход одного из двух игроков завершает матч как победу оставшегося',()=>{
  const {session}=make();
  session.remove('a','a');
  assert.equal(session.snapshot().phase,'finished');
  assert.deepEqual(session.snapshot().result?.winnerIds,['b']);
});

test('после выхода всех игроков партия ставится на паузу',()=>{
  const {session}=make();
  session.remove('a','a');session.remove('b','b');
  assert.equal(session.snapshot().phase,'paused');
});

test('все герои имеют по шесть граней',()=>{
  for(const [id,faces] of Object.entries(HERO_DICE)){
    assert.equal(faces.length,6,id);
    assert.ok(faces.every(f=>Boolean(f.label)));
  }
});

test('время хода настраивается отдельно от восстановления соединения',()=>{
  assert.deepEqual(turnDurations({}),{normalMs:60_000,shortMs:60_000});
  assert.deepEqual(turnDurations({TURN_SECONDS:'15',SHORT_TURN_SECONDS:'5'}),{normalMs:15_000,shortMs:5_000});
});

test('создание комнаты, выбор героев, синхронизация действий',()=>{
  const notices:string[]=[];
  const mgr=new RoomManager(code=>notices.push(code));
  const {code}=mgr.create({nickname:'Host',name:'Зал',maxPlayers:2,token:'host123456789012345'},'host');
  mgr.join({code,nickname:'Guest',token:'guest12345678901234'},'guest');
  mgr.chooseHero('host','warrior');mgr.chooseHero('guest','healer');
  mgr.setReady('host',true);mgr.setReady('guest',true);mgr.start('host');
  mgr.rollDice('host');
  assert.equal(mgr.snapshot(code)?.game?.phase,'choose');
  assert.ok(notices.length>0);
});

test('только хост может запустить следующий этаж через RoomManager',()=>{
  const manager=new RoomManager();
  const {code}=manager.create({nickname:'Host',name:'Путь',maxPlayers:2,token:'host123456789012345'},'h');
  manager.join({code,nickname:'Guest',token:'guest12345678901234'},'g');
  manager.chooseHero('h','warrior');manager.chooseHero('g','healer');
  manager.setReady('h',true);manager.setReady('g',true);manager.start('h');
  assert.throws(()=>manager.nextFloor('h'),/Следующий этаж/);
  // Controlled clear to test host authorization independently of combat randomness.
  const state=(manager as unknown as {rooms:Map<string,{game:{combatants:Map<string,{kind:string;alive:boolean;hp:number}>}}>}).rooms.get(code)!.game.combatants;
  for(const c of state.values())if(c.kind!=='hero'){c.alive=false;c.hp=0;}
  manager.passTurn('h');
  assert.equal(manager.snapshot(code)?.game?.phase,'rest');
  assert.throws(()=>manager.nextFloor('g'),/хосту/);
  manager.nextFloor('h');
  assert.equal(manager.snapshot(code)?.game?.floor,2);
});

test('после выбора грани можно вернуться к паре кубиков, не перебрасывая и не продлевая время', () => {
  const {session} = make();
  session.roll('a','a');
  const previous = session.snapshot();
  session.choose('a',0,'a');
  assert.equal(session.snapshot().phase,'target');
  session.cancelChoice('a');
  assert.equal(session.snapshot().phase,'choose');
  assert.deepEqual(session.snapshot().rolls,previous.rolls);
  assert.equal(session.snapshot().deadlineAt,previous.deadlineAt);
  session.choose('a',1,'a');
  assert.equal(session.snapshot().phase,'target');
});

test('чужой игрок не может отменить выбранную грань, после удара уже поздно', () => {
  const {session,monster} = make();
  session.roll('a','a');session.choose('a',0,'a');
  assert.throws(()=>session.cancelChoice('b'),/другого игрока/);
  session.target('a',monster('a'),'a');
  assert.throws(()=>session.cancelChoice('a'),/Сейчас нельзя выполнять ход/);
});

test('между действием героя и ответной атакой монстра есть 500 мс ожидания', () => {
  const {session,entity,monster,advance} = make();
  session.roll('a','a');session.choose('a',0,'a');session.target('a',monster('a'),'a');
  assert.equal(session.snapshot().phase,'enemy');
  assert.equal(entity('a')?.hp,11);
  advance(499);session.tick(()=>true,id=>id);
  assert.equal(entity('a')?.hp,11);
  advance(1);session.tick(()=>true,id=>id);
  assert.equal(entity('a')?.hp,9);
  assert.equal(session.snapshot().activePlayerId,'b');
  assert.ok(session.snapshot().events.some(e=>e.visual?.type==='strike' && e.visual.targetId==='a'));
});

test('при гибели героя новый сосед определяется среди живых участников', () => {
  const heroes:TestHero[]=[{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'},{id:'c',heroId:'warrior'},{id:'d',heroId:'warrior'},{id:'e',heroId:'archer'}];
  const {session,entity,monster,act} = make(heroes);
  const state=(session as unknown as {combatants:Map<string,{hp:number}>}).combatants;
  state.get('b')!.hp=1;
  act('a','b');
  assert.equal(entity('b')?.alive,false);
  // C becomes A's next living clockwise neighbour, not the dead B.
  session.roll('c','c');session.choose('c',0,'c');
  assert.ok(session.snapshot().availableTargetIds.includes(monster('a')));
  assert.ok(session.snapshot().availableTargetIds.includes(monster('d')));
});

test('после смерти босса без своих монстров атакующий достаёт любого живого монстра и героя', () => {
  const heroes:TestHero[]=[{id:'a',heroId:'warrior'},{id:'b',heroId:'warrior'},{id:'c',heroId:'warrior'},{id:'d',heroId:'warrior'}];
  const {session,monster} = make(heroes);
  const state=(session as unknown as {combatants:Map<string,{hp:number;alive:boolean}>}).combatants;
  state.get('boss')!.hp=0;state.get('boss')!.alive=false;
  state.get(monster('a'))!.hp=0;state.get(monster('a'))!.alive=false;
  session.roll('a','a');session.choose('a',0,'a');
  assert.ok(session.snapshot().availableTargetIds.includes(monster('c')));
  assert.ok(session.snapshot().availableTargetIds.includes('c'));
});

test('после перехода на следующий этаж набор монстров заменён и ID не совпадают', () => {
  const {session} = make();
  const oldIDs = session.snapshot().combatants.filter(c=>c.kind==='monster').map(c=>c.id);
  const state=(session as unknown as {combatants:Map<string,{kind:string;alive:boolean;hp:number}>}).combatants;
  for(const c of state.values())if(c.kind!=='hero'){c.alive=false;c.hp=0;}
  session.pass('a','a');session.continueFloor();
  const next=session.snapshot().combatants.filter(c=>c.kind==='monster');
  assert.ok(next.every(c=>c.alive && c.id.includes('monster:2:')));
  assert.ok(next.every(c=>!oldIDs.includes(c.id)));
  assert.equal(next.length,2);
});

test('журнал содержит идентификаторы для анимаций событий', () => {
  const {session,monster} = make();
  session.roll('a','a');session.choose('a',0,'a');session.target('a',monster('a'),'a');
  const e=session.snapshot().events;
  assert.ok(e.some(x=>x.visual?.type==='strike' && x.visual.targetId===monster('a')));
  assert.ok(e.some(x=>x.visual?.type==='turn' && x.visual.targetId==='a'));
});

test('если игрок покинул комнату во время паузы перед монстром, следующий ход не пропускается', () => {
  const {session,monster}=make([{id:'a',heroId:'warrior'},{id:'b',heroId:'warrior'},{id:'c',heroId:'warrior'}]);
  session.roll('a','a');session.choose('a',0,'a');session.target('a',monster('a'),'a');
  assert.equal(session.snapshot().phase,'enemy');
  session.remove('a','a');
  assert.equal(session.snapshot().phase,'roll');
  assert.equal(session.activePlayer(),'b');
});


test('defeated monster does not resurrect after killing a second monster', () => {
  const {session,entity,monster,act,resolveEnemy}=make();
  const first=monster('a');
  const second=monster('b');
  session.debugSetStat({id:first,field:'hp',value:2});
  session.debugSetStat({id:second,field:'hp',value:2});
  act('a',first);
  assert.equal(entity(first)?.alive,false);
  assert.equal(entity(second)?.alive,true);
  session.pass('b','b');
  resolveEnemy();
  session.roll('a','a');
  session.choose('a',0,'a');
  assert.ok(session.snapshot().availableTargetIds.includes(second));
  assert.ok(!session.snapshot().availableTargetIds.includes(first));
  session.target('a',second,'a');
  assert.equal(entity(first)?.alive,false);
  assert.equal(entity(second)?.alive,false);
  const board = session.snapshot().combatants.filter(c=>c.kind==='monster' && c.alive);
  assert.deepEqual(board,[]);
});
