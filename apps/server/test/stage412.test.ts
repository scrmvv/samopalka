import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HEROES,HERO_DICE,type CombatantSnapshot} from '@samopalka/shared';
import {BalanceStore,defaultBalance,validateBalance,heroFaces,effectiveFoes,BalanceConflict} from '../src/balance.js';
import {AdminAuth,adminCookie,adminToken} from '../src/adminAuth.js';
import {BattleSession} from '../src/battle.js';
import {RoomManager} from '../src/rooms.js';
import {FOES} from '../src/foes.js';
import {printedFoeAction,armorFor} from '../src/effectRules.js';
const players=[{id:'a',heroId:'warrior' as const},{id:'b',heroId:'adept' as const}];
const make=(b=defaultBalance())=>new BattleSession(players,()=>1000,()=>1,()=>0,undefined,b);
const entity=(g:BattleSession,id:string)=>g.snapshot().combatants.find(c=>c.id===id)!;
const foeId=(name:string)=>FOES.find(f=>f.name===name)!.id;

test('4.1: all original heroes and monsters have exactly the original balance',()=>{
  const b=defaultBalance();assert.deepEqual(validateBalance(b),b);
  assert.equal(Object.keys(b.heroes).length,6);assert.equal(Object.keys(b.foes).length,34);
  for(const h of HEROES){assert.equal(b.heroes[h.id].hp,h.hp);assert.deepEqual(heroFaces(b,h.id),HERO_DICE[h.id]);}
  for(const f of effectiveFoes(b)){const original=FOES.find(x=>x.id===f.id)!;assert.equal(f.description,original.description);assert.equal(f.hp,original.hp);assert.deepEqual(printedFoeAction(f),printedFoeAction(original));}
});
test('4.1: validation rejects out-of-range, missing, extra and nonnumeric parameters',()=>{
  const mutations:((b:any)=>void)[]=[b=>b.heroes.warrior.hp=0,b=>b.heroes.warrior.hp='11',b=>b.heroes.warrior.faces[4]=5,b=>b.heroes.warrior.faces.pop(),b=>b.heroes.adept.maxMana=-1,b=>b.heroes.fake={},b=>b.foes.foe_1.strength=1.5,b=>b.foes.foe_1.abilities.fake=2,b=>delete b.foes.foe_1,b=>b.foes[foeId('Надгробие')].strength=3,b=>b.heroes.warrior.extra=true,b=>b.revision=-1];
  for(const mutate of mutations){const b=defaultBalance();mutate(b);assert.throws(()=>validateBalance(b));}
});
test('4.1: disk persistence, revision conflicts, backup, reset and malformed-file rejection',()=>{
  const dir=mkdtempSync(join(tmpdir(),'samopalka-balance-'));try{const file=join(dir,'data','balance.json'),store=new BalanceStore(file),b=store.snapshot();b.heroes.warrior.hp=24;const saved=store.save(b);assert.equal(saved.revision,1);assert.equal(new BalanceStore(file).snapshot().heroes.warrior.hp,24);assert.throws(()=>store.save(b),BalanceConflict);
  const reset=defaultBalance();reset.revision=saved.revision;assert.equal(store.save(reset).heroes.warrior.hp,11);assert.equal(JSON.parse(readFileSync(file+'.bak','utf8')).heroes.warrior.hp,24);assert.equal(new BalanceStore(file).snapshot().revision,2);const copy=store.snapshot();copy.heroes.warrior.hp=333;assert.equal(store.snapshot().heroes.warrior.hp,11);writeFileSync(file,'invalid');assert.throws(()=>new BalanceStore(file));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('4.1: administrator login disabled by default, rate-limited, expires, logs out',()=>{
  assert.deepEqual(new AdminAuth('').login(''),{error:'disabled'});let t=0;const a=new AdminAuth('my-test-password',()=>t);for(let i=0;i<8;i++)assert.deepEqual(a.login('wrong'),{error:'invalid'});assert.deepEqual(a.login('my-test-password'),{error:'limited'});t=900001;const s=a.login('my-test-password');assert.ok('token' in s);if(!('token' in s))return;assert.ok(a.valid(s.token));assert.equal(adminToken('other=1; '+adminCookie(s.token,true)),s.token);assert.match(adminCookie(s.token,true),/HttpOnly; SameSite=Strict.*Secure/);assert.equal(a.valid('fake'),false);a.logout(s.token);assert.equal(a.valid(s.token),false);const second=a.login('my-test-password');assert.ok('token' in second);if('token' in second){t+=28800001;assert.equal(a.valid(second.token),false);}
});
test('4.2: custom health, mana, face values and enemy numbers reach real battle',()=>{
  const b=defaultBalance();b.heroes.warrior.hp=23;b.heroes.warrior.maxMana=8;b.heroes.warrior.faces[2]=7;b.foes.foe_3.hp=19;b.foes.foe_3.strength=6;b.foes.foe_1.hp=27;
  const game=make(b);assert.equal(entity(game,'a').hp,23);assert.equal(entity(game,'a').maxMana,8);assert.equal(game.snapshot().diceFaces!.a[2].label,'Удар 7');assert.equal(entity(game,'monster:1:a').hp,19);assert.equal(entity(game,'boss').hp,27);
  const i=game as unknown as {combatants:Map<string,CombatantSnapshot>;monsterAction(monster:CombatantSnapshot,id:string):void};i.monsterAction(i.combatants.get('monster:1:a')!,'a');assert.equal(entity(game,'a').hp,17);
  // Changes to caller-owned data cannot affect an existing party.
  b.heroes.warrior.faces[2]=1;b.foes.foe_3.strength=2;assert.equal(game.snapshot().diceFaces!.a[2].value,7);assert.match(game.snapshot().foeInfo!['monster:1:a'].description,/Удар, 6/);
});
test('4.2: ability values are used by the engine, not only displayed',()=>{
  const b=defaultBalance();const armor=foeId('Бронезомби'),curse=foeId('Проклятый');b.foes[armor].abilities.armor=4;b.foes[armor].hp=20;b.foes[curse].strength=8;b.foes[curse].abilities.decay=3;
  assert.equal(armorFor(effectiveFoes(b).find(f=>f.id===armor)),4);
  const g=make(b),i=g as unknown as {combatants:Map<string,CombatantSnapshot>;harm(target:CombatantSnapshot,n:number,label:string):number;monsterAction(monster:CombatantSnapshot,id:string):void};const id='monster:1:a';g.debugReplaceFoe({id,foeId:armor});assert.equal(i.harm(i.combatants.get(id)!,6,'test'),2);g.debugReplaceFoe({id,foeId:curse});g.debugSetStat({id:'a',field:'maxHp',value:100});g.debugSetStat({id:'a',field:'hp',value:100});i.monsterAction(i.combatants.get(id)!,'a');assert.equal(entity(g,'a').hp,92);assert.equal(g.snapshot().foeInfo![id].currentAction,'Удар, Гниение, 5');
});
test('4.2: new rooms read saved balance; running parties keep their own catalogue',()=>{
  let balance=defaultBalance();const m=new RoomManager(()=>{},()=>1000,undefined,true,()=>balance);
  const room=(prefix:string)=>{const {code,playerId}=m.create({nickname:'Host',name:'Balance room',maxPlayers:2,token:prefix+'abcdefghijklmnop'},prefix+'h');m.join({code,nickname:'Guest',token:prefix+'qrstuvwxyzabcdef'},prefix+'g');m.chooseHero(prefix+'h','warrior');m.chooseHero(prefix+'g','adept');m.setReady(prefix+'h',true);m.setReady(prefix+'g',true);return{code,playerId};};
  const old=room('x');m.start('xh');balance=defaultBalance();balance.heroes.warrior.hp=39;balance.foes.foe_3.hp=20;const next=room('y');assert.equal(m.snapshot(next.code)!.heroHp!.warrior,39);m.start('yh');assert.equal(m.snapshot(old.code)!.heroHp!.warrior,11);assert.equal(m.snapshot(old.code)!.game!.combatants.find(c=>c.id===old.playerId)!.hp,11);assert.equal(m.snapshot(next.code)!.game!.combatants.find(c=>c.id===next.playerId)!.hp,39);assert.equal(m.snapshot(old.code)!.debug!.foes.find(f=>f.id==='foe_3')!.hp,4);assert.equal(m.snapshot(next.code)!.debug!.foes.find(f=>f.id==='foe_3')!.hp,20);
});
test('4.2: custom leech, sturdy, dodge, dying, plague and death strike affect combat',()=>{
  const b=defaultBalance();const vamp=foeId('Вампир'),sturdy=foeId('Горгулья'),shadow=foeId('Тень'),plague=foeId('Прокаженный'),death=foeId('Гнилец'),dying=FOES.find(f=>printedFoeAction(f).dying)!.id;
  b.foes[vamp].abilities.leech=2;b.foes[sturdy].abilities.sturdy=3;b.foes[shadow].abilities.dodge=4;b.foes[plague].abilities.plague=3;b.foes[death].abilities.deathStrike=2;b.foes[dying].abilities.dying=3;
  const g=make(b),i=g as unknown as {combatants:Map<string,CombatantSnapshot>;harm(target:CombatantSnapshot,n:number,label:string):number;monsterAction(monster:CombatantSnapshot,id:string):void;attackByEnemy(enemy:CombatantSnapshot,target:CombatantSnapshot):void;bossPhase():void};const id='monster:1:a';const mob=i.combatants.get(id)!;const hero=i.combatants.get('a')!;
  g.debugReplaceFoe({id,foeId:sturdy});assert.equal(i.harm(mob,6,'test'),3);
  g.debugReplaceFoe({id,foeId:shadow});assert.equal(entity(g,id).effects?.find(x=>x.kind==='dodge')?.amount,4);
  g.debugReplaceFoe({id:'boss',foeId:vamp});hero.maxHp=100;hero.hp=98;const boss=i.combatants.get('boss')!;i.attackByEnemy(boss,hero);assert.equal(hero.hp,93); // 1 + 2*2
  g.debugReplaceFoe({id,foeId:dying});mob.hp=1;hero.hp=100;i.attackByEnemy(mob,hero);assert.equal(hero.hp,100-3*printedFoeAction(FOES.find(f=>f.id===dying)!).amount);
  g.debugReplaceFoe({id:'boss',foeId:plague});hero.hp=100;i.bossPhase();assert.equal(hero.maxHp,97);
  g.debugReplaceFoe({id,foeId:death});const before=hero.hp;i.harm(mob,100,'test');assert.equal(hero.hp,before-2);assert.equal(hero.effects?.find(x=>x.kind==='poison')?.amount,2);
});
