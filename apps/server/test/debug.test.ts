import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms.js';

const host={nickname:'Host',name:'Тестовая комната',maxPlayers:2,token:'abcdefghijklmnop1'};
const guest={nickname:'Guest',token:'abcdefghijklmnop2'};
function game(debugEnabled:boolean){
  let now=1000;
  const manager=new RoomManager(()=>{},()=>now,undefined,debugEnabled);
  const {code,playerId}=manager.create(host,'host-socket');
  manager.join({...guest,code},'guest-socket');
  manager.chooseHero('host-socket','warrior');
  manager.chooseHero('guest-socket','healer');
  manager.setReady('host-socket',true);
  manager.setReady('guest-socket',true);
  manager.start('host-socket');
  return {manager,code,playerId,advance:(ms:number)=>{now+=ms;manager.cleanupDisconnected();}};
}
test('отладочные действия полностью выключены без DEBUG_TOOLS',()=>{
  const {manager,playerId}=game(false);
  assert.equal(manager.snapshot(manager.getConnection('host-socket')!.code)?.debug,undefined);
  assert.throws(()=>manager.debugAction('host-socket','debug:stat',{id:playerId,field:'hp',value:5}),/отключена/);
});
test('только хост может редактировать текущий бой',()=>{
  const {manager,code,playerId}=game(true);
  assert.ok(manager.snapshot(code)?.debug?.foes.length);
  assert.throws(()=>manager.debugAction('guest-socket','debug:stat',{id:playerId,field:'hp',value:5}),/хосту/);
  manager.debugAction('host-socket','debug:stat',{id:playerId,field:'hp',value:5});
  assert.equal(manager.snapshot(code)?.game?.combatants.find(x=>x.id===playerId)?.hp,5);
});
test('редактор граней синхронизируется, используется в игровом броске',()=>{
  const {manager,code,playerId}=game(true);
  manager.debugAction('host-socket','debug:face',{playerId,index:0,word:'strike',value:7});
  assert.equal(manager.snapshot(code)?.game?.diceFaces?.[playerId]?.[0]?.label,'Удар 7');
  manager.debugAction('host-socket','debug:roll',{first:1,second:1});
  assert.equal(manager.snapshot(code)?.game?.phase,'choose');
  manager.selectDice('host-socket',0);
  assert.equal(manager.snapshot(code)?.game?.pendingAction?.value,7);
  assert.throws(()=>manager.debugAction('host-socket','debug:face',{playerId,index:1,word:'mana',value:3}),/до броска/);
});
test('задаются и удаляются эффекты в текущем состоянии комнаты',()=>{
  const {manager,code,playerId}=game(true);
  manager.debugAction('host-socket','debug:status',{id:playerId,kind:'poison',mode:'add',amount:2});
  assert.equal(manager.snapshot(code)?.game?.combatants.find(x=>x.id===playerId)?.effects?.find(e=>e.kind==='poison')?.amount,2);
  manager.debugAction('host-socket','debug:status',{id:playerId,kind:'poison',mode:'clear'});
  assert.equal(manager.snapshot(code)?.game?.combatants.find(x=>x.id===playerId)?.effects?.length,0);
  assert.throws(()=>manager.debugAction('host-socket','debug:status',{id:playerId,kind:'teleport',mode:'add',amount:2}),/Неизвестное/);
});
test('можно поменять монстра и босса, но нельзя подменить героя',()=>{
  const {manager,code,playerId}=game(true);
  const state=manager.snapshot(code)!.game!;
  const monster=state.combatants.find(c=>c.kind==='monster')!;
  const rat=manager.snapshot(code)!.debug!.foes.find(f=>f.name==='Крыса')!;
  const butcher=manager.snapshot(code)!.debug!.foes.find(f=>f.name==='Мясник')!;
  manager.debugAction('host-socket','debug:foe',{id:monster.id,foeId:rat.id});
  assert.equal(manager.snapshot(code)!.game!.combatants.find(c=>c.id===monster.id)!.name,'Крыса');
  assert.throws(()=>manager.debugAction('host-socket','debug:foe',{id:playerId,foeId:rat.id}),/Героя/);
  assert.throws(()=>manager.debugAction('host-socket','debug:foe',{id:monster.id,foeId:butcher.id}),/не найден/);
  manager.debugAction('host-socket','debug:foe',{id:'boss',foeId:butcher.id});
  assert.equal(manager.snapshot(code)!.game!.combatants.find(c=>c.id==='boss')!.name,'Мясник');
});
test('проверка валидации, переполнения и продления таймера',()=>{
  const {manager,code,playerId}=game(true);
  assert.throws(()=>manager.debugAction('host-socket','debug:stat',{id:playerId,field:'hp',value:-1}),/значение|Значение/);
  assert.throws(()=>manager.debugAction('host-socket','debug:face',{playerId,index:99,word:'strike',value:1}),/Грань/);
  assert.throws(()=>manager.debugAction('host-socket','debug:roll',{first:0,second:6}),/Значения/);
  const before=manager.snapshot(code)!.game!.deadlineAt!;
  manager.debugAction('host-socket','debug:time',120);
  assert.equal(manager.snapshot(code)!.game!.deadlineAt!,before+120_000);
});
