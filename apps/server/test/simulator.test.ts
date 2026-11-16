import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../simulator/runner.js';
import {checkInvariants} from '../simulator/invariants.js';
import {SeededRandom} from '../simulator/random.js';

// Simulator itself is tested. This does not replace independent combat rule tests.
test('seed produces the same game result and trace',()=>{
  const opts={seed:27,players:3,strategy:'mixed' as const,maxSteps:500,trace:true};
  const first=simulate(opts);
  const again=simulate(opts);
  assert.deepEqual(first,again);
});

test('short batches run with real engine without hanging',()=>{
  for(let players=2;players<=6;players++) {
    for(let seed=1;seed<=5;seed++) {
      const result=simulate({seed,players,maxSteps:2000});
      assert.deepEqual(result.errors,[],`seed=${seed}, players=${players}: ${result.errors.join('\n')}`);
      assert.equal(result.completed,true,`seed=${seed}, players=${players}: ${result.outcome}`);
      assert.ok(result.steps>0);
    }
  }
});

test('an intentionally impossible combatant state is caught',()=>{
  const state={floor:1,round:1,phase:'roll',activePlayerId:'p1',deadlineAt:100,serverTime:0,rolls:null,events:[],missedTurns:{},combatants:[{
    id:'p1',kind:'hero',ownerId:'p1',name:'Test',hp:20,maxHp:10,shield:0,mana:0,maxMana:3,alive:true,effects:[]
  }],pendingAction:null,availableTargetIds:[],result:null} as Parameters<typeof checkInvariants>[0];
  assert.ok(checkInvariants(state).some(e=>e.includes('HP out of bounds')));
});

test('RNG has reproducible sequences and stays within dice bounds',()=>{
  const a=new SeededRandom(42);const b=new SeededRandom(42);
  const rolls=Array.from({length:100},()=>a.die());
  assert.deepEqual(rolls,Array.from({length:100},()=>b.die()));
  assert.ok(rolls.every(n=>n>=1&&n<=6));
});

test('standard mode exposes structured analytics, including combat damage and classes',()=>{
  const result=simulate({seed:42,players:4,strategy:'aggressive'});
  assert.equal(result.errors.length,0);
  assert.equal(result.mode,'standard');
  assert.ok(result.analytics.damageToHeroes>0,'expected real enemy damage');
  assert.ok(result.analytics.damageToEnemies>0,'expected hero damage');
  assert.ok(Object.keys(result.analytics.byHero).length===4);
  assert.ok(Object.keys(result.analytics.byFoe).length>0);
  assert.ok(result.analytics.firstHeroDeath);
  assert.ok(result.analytics.heroDeaths>0);
});

test('campaign-smoke reaches the actual sixth-floor end condition',()=>{
  for(const players of [2,4,6]){
    const result=simulate({seed:43,players,mode:'campaign-smoke',maxSteps:2000});
    assert.deepEqual(result.errors,[],`players=${players}: ${result.errors.join('\n')}`);
    assert.equal(result.outcome,'six_floors');
    assert.equal(result.highestFloor,6);
    assert.equal(result.completed,true);
  }
});

test('failure report keeps recent steps even without full trace',()=>{
  const result=simulate({seed:42,players:4,maxSteps:2});
  assert.equal(result.outcome,'step_limit');
  assert.equal(result.trace.length,0);
  assert.ok(result.recentSteps.length>0);
  assert.ok(result.recentSteps[0]?.action);
});

test('telemetry does not change deterministic outcomes',()=>{
  const opts={seed:121,players:4,strategy:'aggressive' as const};
  const first=simulate(opts),again=simulate(opts);
  assert.deepEqual(first.analytics,again.analytics);
  assert.equal(first.steps,again.steps);
});

test('campaign-smoke handles a floor that starts with stunned player',()=>{
  const result=simulate({seed:73,players:4,mode:'campaign-smoke'});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.outcome,'six_floors');
});
