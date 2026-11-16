import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { simulate, type SimulationResult } from './runner.js';
import { AnalyticsAggregate } from './analytics.js';
import type { StrategyId } from './policies.js';
import type { SimulationMode } from './scenarios.js';

function usage(){
  return `Samopalka Game Simulator v1.2\n\n`+
    `Usage: npm run simulate -- --games 100 --players 4 --seed 42 --strategy mixed\n`+
    `Options:\n`+
    `  --games N        Number of independent games (1..100000, default 100)\n`+
    `  --players N      Heroes in each game (2..6, default 4)\n`+
    `  --seed N         Initial seed (default 42); each game uses seed + index\n`+
    `  --strategy NAME  mixed | random | aggressive | support (default mixed)\n`+
    `  --mode NAME      standard | campaign-smoke (default standard)\n`+
    `  --max-steps N    Steps per game (1..100000, default 6000)\n`+
    `  --out PATH       JSON summary path (default simulator-report.json)\n`+
    `  --trace          Save EVERY game trace as JSON (large batches may create huge files)\n`+
    `  --help           Show this text\n\n`+
    `Reproduce: npm run simulate -- --games 1 --seed <seed> --players 4 --strategy mixed --trace\n`+
    `WARNING: campaign-smoke artificially buffs heroes and weakens enemies. Never use it for balance analysis.\n`;
}
function readArgs(args:string[]){
  const values:Record<string,string>={};let trace=false;
  for(let i=0;i<args.length;i++){
    const item=args[i]!;
    if(item==='--help'||item==='-h'){process.stdout.write(usage());process.exit(0);}
    if(item==='--trace'){trace=true;continue;}
    if(!['--games','--players','--seed','--strategy','--mode','--max-steps','--out'].includes(item))throw new Error(`Unknown option ${item}\n${usage()}`);
    const value=args[++i];if(value===undefined||value.startsWith('--'))throw new Error(`Missing value for ${item}`);
    values[item.slice(2)]=value;
  }
  function integer(key:string,fallback:number,min:number,max:number){
    const s=values[key];if(s===undefined)return fallback;
    const number=Number(s);
    if(!Number.isSafeInteger(number)||number<min||number>max)throw new Error(`--${key}: integer from ${min} to ${max} required`);
    return number;
  }
  const strategy=values.strategy??'mixed';
  if(!['mixed','random','aggressive','support'].includes(strategy))throw new Error('Unknown strategy');
  const mode=values.mode??'standard';
  if(!['standard','campaign-smoke'].includes(mode))throw new Error('Unknown mode');
  return {
    games:integer('games',100,1,100000),players:integer('players',4,2,6),
    seed:integer('seed',42,-2147483648,2147483647),
    maxSteps:integer('max-steps',6000,1,100000),strategy:strategy as StrategyId,
    mode:mode as SimulationMode,out:values.out??'simulator-report.json',trace
  };
}

try{
  const opts=readArgs(process.argv.slice(2));
  const outcomes:Record<string,number>={};
  const floors:Record<string,number>={};
  const failures:SimulationResult[]=[];
  const completedTraces:SimulationResult[]=[];
  const analytics=new AnalyticsAggregate();
  let steps=0,failuresCount=0,finished=0;
  for(let i=0;i<opts.games;i++){
    const seed=opts.seed+i;
    const game=simulate({seed,players:opts.players,maxSteps:opts.maxSteps,strategy:opts.strategy,mode:opts.mode,trace:opts.trace});
    outcomes[game.outcome]=(outcomes[game.outcome]??0)+1;
    floors[String(game.highestFloor)]=(floors[String(game.highestFloor)]??0)+1;
    steps+=game.steps;
    if(game.completed)finished++;
    if(game.errors.length){failuresCount++;if(failures.length<20)failures.push(game);}
    analytics.add(game.analytics);
    if(opts.trace)completedTraces.push(game);
  }
  const report={
    meta:{engine:'BattleSession',version:'sim-v1.2',runAt:new Date().toISOString(),...opts,
      balanceComparable:opts.mode==='standard',
      note:opts.mode==='campaign-smoke'?'Synthetic aided progression. These results do NOT reflect normal game balance.':'Real combat values; bot strategies are approximations, not optimal human play.'},
    totals:{games:opts.games,finished,failures:failuresCount,steps,averageSteps:Math.round(steps/opts.games)},
    outcomes,highestFloorDistribution:floors,
    analytics:analytics.report(opts.games),
    failures:failures.map(g=>({seed:g.seed,steps:g.steps,highestFloor:g.highestFloor,outcome:g.outcome,errors:g.errors,lastEvents:g.lastEvents,
      recentSteps:g.recentSteps,
      reproduce:`npm run simulate -- --games 1 --seed ${g.seed} --players ${opts.players} --strategy ${opts.strategy} --mode ${opts.mode} --max-steps ${opts.maxSteps} --trace`}))
  };
  const target=resolve(opts.out);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2),'utf8');
  if(opts.trace){
    const tracePath=target.replace(/\.json$/i,'')+'.traces.json';
    writeFileSync(tracePath,JSON.stringify(completedTraces,null,2),'utf8');
    console.log(`Traces: ${tracePath}`);
  }
  console.log(`Simulated ${opts.games} games, ${steps} steps; failures: ${failuresCount}.`);
  console.log(`Outcomes: ${JSON.stringify(outcomes)} | highest floors: ${JSON.stringify(floors)}`);
  console.log(`Average real damage to heroes: ${report.analytics.perGame.damageToHeroes}; healing: ${report.analytics.perGame.healingToHeroes}.`);
  if(opts.mode==='campaign-smoke')console.log('WARNING: aided campaign smoke test; NOT valid for balance analysis.');
  console.log(`Report: ${target}`);
  if(failuresCount){console.error(`First failed seed: ${failures[0]?.seed}. See JSON for replay.`);process.exitCode=1;}
}catch(err){
  console.error(err instanceof Error?err.message:String(err));
  process.exitCode=2;
}
