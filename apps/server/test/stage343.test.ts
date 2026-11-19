import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { ARTIFACTS } from '../src/artifacts.js';
import { FOES } from '../src/foes.js';
import type { CombatantSnapshot } from '@samopalka/shared';

test('3.4.3: Проклятый decays its OWN face 5→4→3→2→1→0; actual damage follows', () => {
  const battle=new BattleSession([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}],()=>1000,()=>1,()=>0);
  const internal=battle as unknown as {
    combatants:Map<string,CombatantSnapshot>;
    monsterAction(monster:CombatantSnapshot,playerId:string):void;
  };
  const monster=internal.combatants.get('monster:1:a')!;
  const hero=internal.combatants.get('a')!;
  battle.debugReplaceFoe({id:monster.id,foeId:FOES.find(f=>f.name==='Проклятый')!.id});
  hero.maxHp=100;hero.hp=100;hero.shield=0;
  assert.equal(battle.snapshot().foeInfo?.[monster.id]?.currentAction,'Удар, Гниение, 5');
  for(let i=0;i<7;i++){
    const before=hero.hp;
    internal.monsterAction(monster,'a');
    const strength=Math.max(0,5-i);
    assert.equal(before-hero.hp,strength,`удар ${i+1} должен быть ${strength}`);
    assert.equal(battle.snapshot().foeInfo?.[monster.id]?.currentAction,`Удар, Гниение, ${Math.max(0,4-i)}`);
    assert.match(battle.snapshot().foeInfo?.[monster.id]?.description??'',new RegExp(`Гниение, ${Math.max(0,4-i)}`));
  }
});

test('3.4.3: replacing the cursed monster resets its face decay',()=>{
  const battle=new BattleSession([{id:'a',heroId:'warrior'},{id:'b',heroId:'healer'}],()=>1000,()=>1,()=>0);
  const intern=battle as unknown as {combatants:Map<string,CombatantSnapshot>;monsterAction(monster:CombatantSnapshot,playerId:string):void};
  const id='monster:1:a';
  const cursed=FOES.find(f=>f.name==='Проклятый')!;
  battle.debugReplaceFoe({id,foeId:cursed.id});
  intern.monsterAction(intern.combatants.get(id)!,'a');
  assert.equal(battle.snapshot().foeInfo?.[id]?.currentAction,'Удар, Гниение, 4');
  battle.debugReplaceFoe({id,foeId:cursed.id});
  assert.equal(battle.snapshot().foeInfo?.[id]?.currentAction,'Удар, Гниение, 5');
});

function hostRoom(debug=true){
  const manager=new RoomManager(()=>{},()=>1000,undefined,debug);
  const {code,playerId}=manager.create({nickname:'Host',name:'Проверка артефактов',maxPlayers:2,token:'abcdefghijklmnop1'},'h');
  manager.join({code,nickname:'Guest',token:'abcdefghijklmnop2'},'g');
  manager.chooseHero('h','warrior');manager.chooseHero('g','healer');
  manager.setReady('h',true);manager.setReady('g',true);manager.start('h');
  return {manager,code,playerId,guestId:manager.snapshot(code)!.players[1]!.id};
}

test('3.4.3: test panel lists supported artifacts; only host may grant them',()=>{
  const {manager,code,playerId}=hostRoom();
  assert.equal(manager.snapshot(code)?.debug?.artifacts.length,ARTIFACTS.length);
  const card=ARTIFACTS.find(a=>a.kind==='face')!;
  assert.throws(()=>manager.debugAction('g','debug:artifact',{playerId,artifactId:card.id,faceIndex:1}),/хосту/);
  assert.throws(()=>manager.debugAction('h','debug:artifact',{playerId,artifactId:'not-an-artifact',faceIndex:1}),/не найден/);
  assert.throws(()=>manager.debugAction('h','debug:artifact',{playerId,artifactId:card.id}),/грань|грань кубика/);
  assert.throws(()=>manager.debugAction('h','debug:artifact',{playerId,artifactId:card.id,faceIndex:6}),/грань|грань кубика/);
});

test('3.4.3: test artifact replaces only selected side; duplicates receive unique inventory IDs',()=>{
  const {manager,code,playerId}=hostRoom();
  const card=ARTIFACTS.find(a=>a.kind==='face'&&a.tier===1)!;
  const before=manager.snapshot(code)!.game!.diceFaces![playerId]!.map(x=>x.label);
  manager.debugAction('h','debug:artifact',{playerId,artifactId:card.id,faceIndex:1});
  const after=manager.snapshot(code)!.game!;
  assert.equal(after.diceFaces![playerId]![0]!.label,before[0]);
  assert.equal(after.diceFaces![playerId]![1]!.label,card.face!.label);
  assert.deepEqual(after.diceFaces![playerId]!.slice(2).map(x=>x.label),before.slice(2));
  manager.debugAction('h','debug:artifact',{playerId,artifactId:card.id,faceIndex:2});
  const ids=manager.snapshot(code)!.game!.inventories![playerId]!.map(x=>x.instanceId);
  assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
});

test('3.4.3: passive test artifacts do not replace faces or affect reward drafts',()=>{
  const {manager,code,playerId,guestId}=hostRoom();
  const passive=ARTIFACTS.find(a=>a.kind==='maxhp')!;
  const before=manager.snapshot(code)!.game!;
  const faces=before.diceFaces![guestId]!.map(x=>x.label);
  const hp=before.combatants.find(x=>x.id===guestId)!.maxHp;
  manager.debugAction('h','debug:artifact',{playerId:guestId,artifactId:passive.id,faceIndex:2});
  const after=manager.snapshot(code)!.game!;
  assert.equal(after.combatants.find(x=>x.id===guestId)!.maxHp,hp+passive.amount!);
  assert.deepEqual(after.diceFaces![guestId]!.map(x=>x.label),faces);
  assert.equal(after.inventories![guestId]![0]!.faceIndex,undefined);
  assert.equal(after.rewardDraft,null);
  assert.equal(after.phase,before.phase);
  assert.equal(after.activePlayerId,before.activePlayerId);
  assert.equal(after.deadlineAt,before.deadlineAt);
  assert.equal(after.inventories![playerId]?.length,0);
});

test('3.4.3: artifact grants disabled server-side when debug tools are off',()=>{
  const {manager,playerId}=hostRoom(false);
  assert.throws(()=>manager.debugAction('h','debug:artifact',{playerId,artifactId:ARTIFACTS[0]!.id,faceIndex:0}),/отключена/);
});
