import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {CombatantSnapshot,DiceFace} from '@samopalka/shared';
import {BalanceStore,defaultBalance,validateBalance,BalanceConflict} from '../src/balance.js';
import {CONTENT_ROWS,effectiveArtifacts,effectiveSpells} from '../src/balanceContent.js';
import {ARTIFACTS} from '../src/artifacts.js';
import {BattleSession} from '../src/battle.js';
import {RoomManager} from '../src/rooms.js';
import {addEffect,statusValue} from '../src/effectRules.js';
import {rollAllAtCamp} from './stage342.helpers.js';
const players=[{id:'a',heroId:'adept' as const},{id:'b',heroId:'warrior' as const}];
function game(b=defaultBalance()){return new BattleSession(players,()=>1000,()=>1,()=>0,undefined,b);}
const entity=(g:BattleSession,id:string)=>g.snapshot().combatants.find(c=>c.id===id)!;
const grant=(g:BattleSession,artifactId:string,playerId='a',faceIndex?:number)=>g.debugGrantArtifact({playerId,artifactId,faceIndex});
const card=(kind:string)=>ARTIFACTS.find(a=>a.kind===kind)!;
const mana=(g:BattleSession,value:number)=>g.debugSetStat({id:'a',field:'mana',value});
const spell=(g:BattleSession,id:string)=>g.snapshot().spells!.a!.find(x=>x.id===id)!;
const intern=(g:BattleSession)=>g as unknown as {combatants:Map<string,CombatantSnapshot>;artifactFaces:Map<string,DiceFace[]>;applyStartOfTurn(c:CombatantSnapshot):void;applyEndOfTurn(c:CombatantSnapshot):void;attackByEnemy(c:CombatantSnapshot,t:CombatantSnapshot):void};

test('4.3: full catalogue contains 157 cards, 59 cast actions and six effect settings with validated defaults',()=>{
 const b=defaultBalance();assert.deepEqual(validateBalance(b),b);assert.equal(CONTENT_ROWS.artifacts.length,157);assert.equal(CONTENT_ROWS.spells.length,59);assert.equal(CONTENT_ROWS.effects.length,6);assert.equal(effectiveArtifacts(b).length,157);assert.equal(effectiveSpells(b).length,59);assert.equal(CONTENT_ROWS.artifacts.filter(r=>r.fields.length).length,101);
});
test('4.3: all numeric fields have real finite integer bounds; invalid edits and unknown/missing fields are rejected',()=>{
 for(const key of ['artifacts','spells','effects'] as const)for(const r of CONTENT_ROWS[key])for(const f of r.fields){const b=defaultBalance();b[key][r.id]![f.key]=f.max;assert.doesNotThrow(()=>validateBalance(b));b[key][r.id]![f.key]=f.max+1;assert.throws(()=>validateBalance(b));}
 const b=defaultBalance();b.spells['hero-adept-shield2']!.cost=0;assert.throws(()=>validateBalance(b));b.spells['hero-adept-shield2']!.cost=2;b.effects.poison!.extra=1;assert.throws(()=>validateBalance(b));delete b.effects.poison!.extra;delete b.artifacts[card('face').id];assert.throws(()=>validateBalance(b));
});
test('4.4: old balance file migrates without losing custom heroes, foes or revision; save persists new parameters and backs up old file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'samopalka-stage4-'));try{const file=join(dir,'balance.json');const old=defaultBalance();old.heroes.warrior.hp=37;old.foes.foe_3.hp=28;old.revision=5;const legacy={revision:old.revision,heroes:old.heroes,foes:old.foes};writeFileSync(file,JSON.stringify(legacy));const store=new BalanceStore(file);const loaded=store.snapshot();assert.equal(loaded.heroes.warrior.hp,37);assert.equal(loaded.foes.foe_3.hp,28);assert.equal(loaded.revision,5);assert.equal(loaded.spells['hero-adept-shield2']!.cost,2);assert.throws(()=>store.save(legacy));loaded.spells['hero-adept-shield2']!.cost=4;loaded.effects.poison!.factor=2;loaded.artifacts[card('hp').id]!.amount=9;const saved=store.save(loaded);assert.equal(saved.revision,6);assert.deepEqual(new BalanceStore(file).snapshot(),saved);assert.deepEqual(JSON.parse(readFileSync(file+'.bak','utf8')),legacy);assert.throws(()=>store.save(loaded),BalanceConflict);const reset=defaultBalance();reset.revision=6;assert.deepEqual(store.save(reset).spells,defaultBalance().spells);assert.deepEqual(new BalanceStore(file).snapshot().effects,defaultBalance().effects);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('4.3: numeric artifact edits apply to health, healing, face replacement, all-face bonus and multiplier',()=>{
 const b=defaultBalance();for(const kind of ['hp','maxhp','consumable','buffall','doubleface'])b.artifacts[card(kind).id]!.amount=kind==='doubleface'?3:4;
 b.artifacts[card('face').id]!.faceValue=7;const g=game(b);const hp=entity(g,'a').hp;
 grant(g,card('hp').id);assert.equal(entity(g,'a').hp,hp+4);assert.equal(entity(g,'a').maxHp,hp+4);grant(g,card('maxhp').id);assert.equal(entity(g,'a').hp,hp+4);assert.equal(entity(g,'a').maxHp,hp+8);
 grant(g,card('face').id,'a',0);assert.equal(g.snapshot().diceFaces!.a![0]!.value,7);assert.match(g.snapshot().diceFaces!.a![0]!.label,/7/);grant(g,card('buffall').id);assert.equal(g.snapshot().diceFaces!.a![0]!.value,11);grant(g,card('doubleface').id,'a',0);assert.equal(g.snapshot().diceFaces!.a![0]!.value,33);
 grant(g,card('consumable').id);g.debugSetStat({id:'a',field:'hp',value:2});const item=g.snapshot().inventories!.a!.find(a=>a.kind==='consumable')!;g.useArtifact('a',item.instanceId);assert.equal(entity(g,'a').hp,6);assert.throws(()=>g.useArtifact('a',item.instanceId));
});
test('4.3: normal reward draft reads the session balance and preserves card values when claimed',()=>{
 const b=defaultBalance();const first=ARTIFACTS.find(a=>a.tier===1&&a.kind==='face')!;b.artifacts[first.id]!.faceValue=8;const g=game(b);for(const c of intern(g).combatants.values())if(c.kind!=='hero'){c.alive=false;c.hp=0;}g.pass('a','a');rollAllAtCamp(g);const draft=g.snapshot().rewardDraft!;const offered=draft.offers.find(a=>a.id===first.id)!;assert.equal(offered.face!.value,8);g.claimReward(draft.playerId!,first.id,0);assert.equal(g.snapshot().diceFaces![draft.playerId!]![0]!.value,8);
});
test('4.3: native and artifact spells use edited cost and power; insufficient mana cannot mutate target',()=>{
 const b=defaultBalance();b.spells['hero-adept-shield2']!.cost=4;b.spells['hero-adept-shield2']!.part0=7;b.spells['spell-spellcard-009']!.cost=3;b.spells['spell-spellcard-009']!.part0=5;const g=game(b);grant(g,'spellcard-009');mana(g,3);assert.equal(spell(g,'hero-adept-shield2').cost,4);assert.match(spell(g,'hero-adept-shield2').description,/Щит 7/);assert.throws(()=>g.castSpell('a','hero-adept-shield2','a'),/Недостаточно маны/);assert.equal(entity(g,'a').shield,0);assert.equal(entity(g,'a').mana,3);mana(g,7);g.castSpell('a','hero-adept-shield2','a');assert.equal(entity(g,'a').shield,7);assert.equal(entity(g,'a').mana,3);g.debugSetStat({id:'a',field:'hp',value:1});g.castSpell('a','spell-spellcard-009');assert.equal(entity(g,'a').hp,6);assert.equal(entity(g,'a').mana,0);assert.throws(()=>g.castSpell('a','spell-spellcard-009'),/уже использовано/);
});
test('4.3: spell passive healing, shield, reaction, repeat cost and discount use edited amounts',()=>{
 const b=defaultBalance();b.artifacts['spellpassive-026']!.amount=4;b.artifacts['spellpassive-341']!.amount=6;b.artifacts['spellpassive-138']!.amount=3;b.artifacts['spellpassive-348']!.amount=2;b.spells['hero-adept-shield2']!.cost=5;b.spells['spell-spellcard-181']!.cost=6;b.spells['spell-spellcard-181']!.repeatDiscount=2;const g=game(b);grant(g,'spellpassive-026','b');grant(g,'spellpassive-341','b');grant(g,'spellpassive-138');grant(g,'spellpassive-348');grant(g,'spellcard-181');g.debugSetStat({id:'b',field:'hp',value:2});mana(g,20);g.castSpell('a','hero-adept-shield2','a');assert.equal(entity(g,'b').hp,6);assert.equal(entity(g,'b').shield,6);assert.equal(spell(g,'hero-adept-shield2').cost,3);const reaction=spell(g,'spell-react-138');assert.match(reaction.title,/3/);const target=reaction.targets.find(x=>x.startsWith('monster:'))!;const hp=entity(g,target).hp;g.castSpell('a',reaction.id,target);assert.equal(entity(g,target).hp,hp-3);assert.equal(spell(g,'spell-spellcard-181').cost,4);g.castSpell('a','spell-spellcard-181','a');assert.equal(spell(g,'spell-spellcard-181').cost,1);
});
test('4.3: poison, regeneration and weakness factors change actual combat and keep fixed rules',()=>{
 const b=defaultBalance();b.effects.poison!.factor=3;b.effects.regeneration!.factor=2;b.effects.weakness!.factor=2;const g=game(b),i=intern(g),a=i.combatants.get('a')!;a.hp=7;a.shield=10;addEffect(a,'poison',2);i.applyEndOfTurn(a);assert.equal(a.hp,1);assert.equal(a.shield,10);addEffect(a,'regeneration',4);assert.equal(statusValue(a,'poison'),0);i.applyStartOfTurn(a);assert.equal(a.hp,5);addEffect(a,'weakness',1);assert.equal(g.snapshot().diceFaces!.a![0]!.value,Math.max(0,defaultBalance().heroes.adept.faces[0]!-2));const enemy=i.combatants.get('monster:1:a')!;a.hp=a.maxHp;a.shield=0;addEffect(enemy,'weakness',1);const before=a.hp;i.attackByEnemy(enemy,a);assert.equal(a.hp,before); // default attack 2, fully weakened
});
test('4.3: growth, decay and paralysis apply to real cube actions with binary status and zero lower bound',()=>{
 for(const word of ['Рост','Гниение'] as const){const b=defaultBalance();b.effects.growth!.step=3;b.effects.decay!.step=5;b.effects.paralysis!.factor=2;const g=game(b),i=intern(g),a=i.combatants.get('a')!;const faces=g.snapshot().diceFaces!.a!;faces[0]={kind:'heal',value:2,label:`Лечение, ${word}, 2`};i.artifactFaces.set('a',faces);addEffect(a,'paralysis',9);assert.equal(statusValue(a,'paralysis'),1);const hp=a.hp;g.debugSetRoll({first:1,second:1});g.choose('a',0,'a');g.target('a','b','a');assert.equal(a.hp,hp-4);assert.equal(g.snapshot().diceFaces!.a![0]!.value,word==='Рост'?5:0);}
});
test('4.4: new rooms read updated cards and spell parameters, started rooms retain old data',()=>{
 let b=defaultBalance();const m=new RoomManager(()=>{},()=>1000,undefined,true,()=>b);const room=(p:string)=>{const {code,playerId}=m.create({nickname:'Host',name:'Balance room',maxPlayers:2,token:p+'abcdefghijklmnop'},p+'h');m.join({code,nickname:'Guest',token:p+'qrstuvwxyzabcdef'},p+'g');m.chooseHero(p+'h','adept');m.chooseHero(p+'g','warrior');m.setReady(p+'h',true);m.setReady(p+'g',true);m.start(p+'h');return {code,playerId};};const a=room('x');const id=card('face').id;b.artifacts[id]!.faceValue=9;b.spells['hero-adept-shield2']!.cost=8;const c=room('y');assert.equal(m.snapshot(a.code)!.game!.spells![a.playerId]!.find(s=>s.id==='hero-adept-shield2')!.cost,2);assert.equal(m.snapshot(c.code)!.game!.spells![c.playerId]!.find(s=>s.id==='hero-adept-shield2')!.cost,8);assert.doesNotMatch(m.snapshot(a.code)!.debug!.artifacts.find(x=>x.id===id)!.title,/9/);assert.match(m.snapshot(c.code)!.debug!.artifacts.find(x=>x.id===id)!.title,/9/);
});
