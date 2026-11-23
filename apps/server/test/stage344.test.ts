import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../src/battle.js';
import { RoomManager } from '../src/rooms.js';
import { ARTIFACTS } from '../src/artifacts.js';
import { ARTIFACT_SPELLS,SPELL_ARTIFACT_CARDS } from '../src/spells.js';

function battle(hero:'healer'|'adept'|'warrior'='adept'){
  let clock=1_000;
  const game=new BattleSession([{id:'a',heroId:hero},{id:'b',heroId:'warrior'}],()=>clock,()=>3,()=>0);
  return {game,advance:(n:number)=>{clock+=n;game.tick(()=>true,id=>id);}};
}
function mana(game:BattleSession,amount:number){game.debugSetStat({id:'a',field:'mana',value:amount});}
function spell(game:BattleSession,id:string){return game.snapshot().spells?.a?.find(s=>s.id===id);}

test('3.4.4: 54 spreadsheet spell artifacts have unique IDs, costs and a server action',()=>{
  assert.equal(SPELL_ARTIFACT_CARDS.length,54);
  assert.equal(ARTIFACT_SPELLS.length,56); // 2 cards offer two actions
  assert.equal(new Set(SPELL_ARTIFACT_CARDS.map(x=>x.id)).size,54);
  assert.equal(SPELL_ARTIFACT_CARDS.filter(c=>ARTIFACTS.some(a=>a.id===c.id)).length,0);
  for(const card of SPELL_ARTIFACT_CARDS){
    assert.equal(card.kind,'spell');
    assert.ok(card.description.includes('ман'));
    assert.ok(ARTIFACT_SPELLS.some(s=>s.artifactId===card.id&&s.parts.length>0&&s.cost>0));
  }
});

test('3.4.4: adept gains mana from a face, stays on spell phase, pays mana, and can end turn',()=>{
  const {game}=battle();
  assert.equal(spell(game,'hero-adept-strike2')?.available,false);
  game.roll('a','Маг');game.choose('a',0,'Маг');
  assert.equal(game.snapshot().phase,'spell');
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.mana,2);
  const target=spell(game,'hero-adept-strike2')!.targets.find(id=>id.startsWith('monster:'))!;
  assert.ok(target);
  assert.throws(()=>game.castSpell('a','hero-adept-strike2','fake'),/цель/);
  game.castSpell('a','hero-adept-strike2',target);
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.mana,0);
  assert.equal(game.snapshot().phase,'spell');
  game.pass('a','Маг');
  assert.equal(game.snapshot().phase,'enemy');
});

test('3.4.4: healer sets HP precisely to six, including reduction, and has no unlimited mana',()=>{
  const {game}=battle('healer');
  mana(game,5);
  game.debugSetStat({id:'b',field:'hp',value:8});
  game.castSpell('a','hero-healer-set6','b');
  assert.equal(game.snapshot().combatants.find(c=>c.id==='b')!.hp,6);
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.mana,3);
  game.debugSetStat({id:'b',field:'hp',value:2});
  game.castSpell('a','hero-healer-set6','b');
  assert.equal(game.snapshot().combatants.find(c=>c.id==='b')!.hp,6);
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.mana,1);
  assert.throws(()=>game.castSpell('a','hero-healer-set6','b'),/Недостаточно маны/);
});

test('3.4.4: granted artifact spell is castable; one-per-turn enforced; mana cost server authoritative',()=>{
  const {game}=battle('warrior');
  game.debugGrantArtifact({playerId:'a',artifactId:'spellcard-009'});
  mana(game,3);
  game.debugSetStat({id:'a',field:'hp',value:5});
  assert.equal(spell(game,'spell-spellcard-009')?.available,true);
  assert.throws(()=>game.castSpell('b','spell-spellcard-009'),/ход другого/);
  game.castSpell('a','spell-spellcard-009');
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.hp,7);
  assert.equal(game.snapshot().combatants.find(c=>c.id==='a')!.mana,2);
  assert.equal(spell(game,'spell-spellcard-009')?.available,false);
  assert.throws(()=>game.castSpell('a','spell-spellcard-009'),/лимит/);
});

test('3.4.4: repeatable artifact spell costs 3, 2, then 1 mana in same turn',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'a',artifactId:'spellcard-264'});
  mana(game,9);
  const spellId='spell-spellcard-264';
  const target=spell(game,spellId)!.targets.find(id=>id.startsWith('monster:'))!;
  assert.equal(spell(game,spellId)!.cost,3);
  game.castSpell('a',spellId,target);
  assert.equal(spell(game,spellId)!.cost,2);
  game.castSpell('a',spellId,target);
  assert.equal(spell(game,spellId)!.cost,1);
});

test('3.4.4: all-monsters spell damages enemies but not heroes, including boss',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'a',artifactId:'spellcard-337'});
  mana(game,4);
  const before=game.snapshot().combatants.map(c=>({id:c.id,hp:c.hp,kind:c.kind}));
  game.castSpell('a','spell-spellcard-337');
  const after=game.snapshot();
  for(const c of before){
    const actual=after.combatants.find(x=>x.id===c.id)!;
    if(c.kind==='hero')assert.equal(actual.hp,c.hp);
    else assert.ok(actual.hp<=c.hp);
  }
});

test('3.4.4: strangers cannot cast another player spells through Socket.IO room manager',()=>{
  const m=new RoomManager(()=>{},()=>1_000,undefined,true);
  const {code,playerId}=m.create({nickname:'Host',name:'Проверка заклинаний',maxPlayers:2,token:'abcdefghijklmnop1'},'h');
  m.join({code,nickname:'Guest',token:'abcdefghijklmnop2'},'g');
  m.chooseHero('h','adept');m.chooseHero('g','warrior');
  m.setReady('h',true);m.setReady('g',true);m.start('h');
  m.debugAction('h','debug:stat',{id:playerId,field:'mana',value:2});
  assert.throws(()=>m.castSpell('g','hero-adept-shield2',playerId),/ход другого/);
  m.castSpell('h','hero-adept-shield2',playerId);
  assert.equal(m.snapshot(code)!.game!.combatants.find(x=>x.id===playerId)!.shield,2);
});

test('3.4.4: smoke cast each of 54 spreadsheet spells, validating server target and cost',()=>{
  for(const card of SPELL_ARTIFACT_CARDS){
    const {game}=battle();
    game.debugGrantArtifact({playerId:'a',artifactId:card.id});
    mana(game,100);
    const spells=game.snapshot().spells!.a!.filter(x=>x.artifactId===card.id);
    assert.ok(spells.length>0,card.id);
    for(const current of spells){
      const other=game.snapshot().combatants.find(c=>c.id==='b')!;
      if(current.targets.length===0 && current.id==='spell-spellcard-324'){
        const intern=game as unknown as {combatants:Map<string,typeof other>};
        const c=intern.combatants.get('b')!;
        c.hp=0;c.alive=false;
      }
      const option=game.snapshot().spells!.a!.find(x=>x.id===current.id)!;
      assert.ok(option.available,`${card.id}: ${option.description} should be castable`);
      const targetId=option.targets.find(x=>x==='b')??option.targets.find(x=>x.startsWith('monster:'))??option.targets[0];
      assert.doesNotThrow(()=>game.castSpell('a',option.id,targetId),card.id);
    }
  }
});

test('3.4.4: global healing and shield passives trigger for someone else casting',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'b',artifactId:'spellpassive-026'});
  game.debugGrantArtifact({playerId:'b',artifactId:'spellpassive-341'});
  game.debugSetStat({id:'b',field:'hp',value:5});
  mana(game,2);
  game.castSpell('a','hero-adept-shield2','a');
  const b=game.snapshot().combatants.find(x=>x.id==='b')!;
  assert.equal(b.hp,6);
  assert.equal(b.shield,3);
});

test('3.4.4: optional reactive strike generated by spell is available at zero mana and used once',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'a',artifactId:'spellpassive-138'});
  mana(game,2);
  game.castSpell('a','hero-adept-shield2','a');
  const reaction=spell(game,'spell-react-138')!;
  assert.equal(reaction.cost,0);
  assert.ok(reaction.available);
  const target=reaction.targets.find(id=>id.startsWith('monster:'))!;
  game.castSpell('a',reaction.id,target);
  assert.equal(spell(game,'spell-react-138'),undefined);
});

test('3.4.4: free-cast consumable gets spent and cannot be reused',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'a',artifactId:'spellpassive-278'});
  assert.equal(game.snapshot().spellFree?.a,true);
  assert.throws(()=>game.castSpell('a','hero-adept-shield2','a'),/Недостаточно маны/);
  game.castSpell('a','hero-adept-shield2','a',true);
  assert.equal(game.snapshot().combatants.find(x=>x.id==='a')!.mana,0);
  assert.equal(game.snapshot().inventories?.a?.[0]?.spent,true);
  assert.equal(game.snapshot().spellFree?.a,false);
  assert.throws(()=>game.castSpell('a','hero-adept-shield2','a',true),/недоступно|Недостаточно/);
});

test('3.4.4: discount passive reduces cost of next cast, min one mana',()=>{
  const {game}=battle();
  game.debugGrantArtifact({playerId:'a',artifactId:'spellpassive-348'});
  mana(game,6);
  assert.equal(spell(game,'hero-adept-shield2')?.cost,2);
  game.castSpell('a','hero-adept-shield2','a');
  assert.equal(spell(game,'hero-adept-shield2')?.cost,1);
  game.castSpell('a','hero-adept-shield2','a');
  assert.equal(spell(game,'hero-adept-shield2')?.cost,1);
});
