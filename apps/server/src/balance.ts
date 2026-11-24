import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HEROES, HERO_DICE, type HeroId, type DiceFace } from '@samopalka/shared';
import { FOES, type FoeDefinition } from './foes.js';
import { armorFor, printedFoeAction } from './effectRules.js';
import { CONTENT_ROWS, defaultContent, type ContentBalance } from './balanceContent.js';

export type AbilityKey = 'armor'|'dodge'|'sturdy'|'leech'|'plague'|'deathStrike'|'growth'|'decay'|'dying';
export type HeroBalance = { hp:number; maxMana:number; faces:number[] };
export type FoeBalance = { hp:number; strength:number|null; abilities:Partial<Record<AbilityKey,number>> };
export type Balance = { revision:number; heroes:Record<string,HeroBalance>; foes:Record<string,FoeBalance> } & ContentBalance;
export class BalanceError extends Error {}
export class BalanceConflict extends BalanceError {}
export const ABILITY_LABELS:Record<AbilityKey,string> = {armor:'Броня: снижение урона',dodge:'СамоУворот: количество',sturdy:'Прочность: предел урона',leech:'Пиявка: бонус за недостающее HP',plague:'Чума: потеря максимального HP',deathStrike:'Посмертный удар и яд',growth:'Рост: прибавка за применение',decay:'Гниение: потеря за применение',dying:'Издыхание: множитель урона'};
function abilities(def:FoeDefinition):FoeBalance['abilities'] {
  const out:FoeBalance['abilities']={}; const desc=def.description; const action=printedFoeAction(def);
  if(desc.includes('Броня:'))out.armor=armorFor(def);
  if(def.name==='Тень')out.dodge=1;
  if(desc.includes('Прочность:'))out.sturdy=1;
  if(desc.includes('Пиявка:'))out.leech=1;
  if(def.name==='Прокаженный')out.plague=1;
  if(def.name==='Гнилец')out.deathStrike=1;
  if(action.growth)out.growth=1;
  if(action.decay)out.decay=1;
  if(action.dying)out.dying=2;
  return out;
}
export function defaultBalance():Balance {
  return {...defaultContent(),revision:0,heroes:Object.fromEntries(HEROES.map(h=>[h.id,{hp:h.hp,maxMana:3,faces:HERO_DICE[h.id].map(f=>f.value)}])),foes:Object.fromEntries(FOES.map(f=>[f.id,{hp:f.hp,strength:printedFoeAction(f).strike?printedFoeAction(f).amount:null,abilities:abilities(f)}]))};
}
function object(v:unknown,label:string):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new BalanceError(`${label}: ожидается объект.`);return v as Record<string,unknown>;}
function exact(v:Record<string,unknown>,expected:string[],label:string){const keys=Object.keys(v);if(keys.length!==expected.length||expected.some(k=>!Object.hasOwn(v,k)))throw new BalanceError(`${label}: неизвестные или отсутствующие поля.`);}
function integer(v:unknown,min:number,max:number,label:string):number {if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new BalanceError(`${label}: целое число от ${min} до ${max}.`);return v;}
export function validateBalance(input:unknown):Balance {
  const d=defaultBalance(),root=object(input,'Баланс');exact(root,['revision','heroes','foes','artifacts','spells','effects'],'Баланс');
  const revision=integer(root.revision,0,Number.MAX_SAFE_INTEGER-1,'Ревизия');
  const heroes=object(root.heroes,'Герои'),foes=object(root.foes,'Противники');exact(heroes,Object.keys(d.heroes),'Герои');exact(foes,Object.keys(d.foes),'Противники');
  for(const h of HEROES){const row=object(heroes[h.id],h.name);exact(row,['hp','maxMana','faces'],h.name);if(!Array.isArray(row.faces)||row.faces.length!==6)throw new BalanceError(`${h.name}: нужны шесть граней.`);const faceValues=row.faces;d.heroes[h.id]={hp:integer(row.hp,1,500,h.name+' HP'),maxMana:integer(row.maxMana,0,100,h.name+' мана'),faces:HERO_DICE[h.id].map((f,i)=>integer(faceValues[i],0,f.kind==='empty'?0:100,`${h.name}, грань ${i+1}`))};}
  for(const f of FOES){const row=object(foes[f.id],f.name),base=d.foes[f.id]!;exact(row,['hp','strength','abilities'],f.name);const values=object(row.abilities,f.name+' способности');exact(values,Object.keys(base.abilities),f.name+' способности');const result:FoeBalance['abilities']={};for(const k of Object.keys(base.abilities) as AbilityKey[]) result[k]=integer(values[k],k==='dying'?1:0,k==='dying'?10:100,`${f.name}: ${ABILITY_LABELS[k]}`);if(base.strength===null&&row.strength!==null)throw new BalanceError(`${f.name}: нет числовой атакующей грани.`);d.foes[f.id]={hp:integer(row.hp,1,500,f.name+' HP'),strength:base.strength===null?null:integer(row.strength,0,100,f.name+' сила'),abilities:result};}
  for(const key of ['artifacts','spells','effects'] as const){
    const rows=object(root[key],key);exact(rows,Object.keys(d[key]),key);
    for(const spec of CONTENT_ROWS[key]){const row=object(rows[spec.id],spec.name);exact(row,spec.fields.map(f=>f.key),spec.name);for(const f of spec.fields)d[key][spec.id]![f.key]=integer(row[f.key],f.min,f.max,`${spec.name}: ${f.label}`);}
  }
  return {...d,revision};
}
export function heroFaces(balance:Balance,id:HeroId):DiceFace[]{return HERO_DICE[id].map((f,i)=>{const value=balance.heroes[id]!.faces[i]!;return {...f,value,label:value===f.value?f.label:f.label.replace(/\d+(?!.*\d)/,String(value))};});}
export function effectiveFoes(balance:Balance):FoeDefinition[]{return FOES.map(f=>{const b=balance.foes[f.id]!,a=b.abilities;let description=f.description;
  if(b.strength!==null)description=description.replace(/^\s*"[^"]+"/,m=>m.replace(/\d+(?!.*\d)/,String(b.strength)));
  if(a.armor!==undefined)description=description.replace(/(Броня:\s*Получает на\s*)\d+/,(_,p)=>p+a.armor);
  if(a.dodge!==undefined)description=description.replace(/(СамоУворот,\s*)\d+/g,(_,p)=>p+a.dodge);
  if(a.sturdy!==undefined)description=description.replace(/(снимает ему\s*)\d+/,(_,p)=>p+a.sturdy);
  if(a.leech!==undefined)description=description.replace(/(Пиявка:\s*\+)\d+/,(_,p)=>p+a.leech);
  if(a.plague!==undefined)description=description.replace(/(Чума:\s*-)\d+/,(_,p)=>p+a.plague);
  if(a.deathStrike!==undefined)description=description.replace(/(После смерти:[^\n]*,\s*)\d+/,(_,p)=>p+a.deathStrike);
  return {...f,hp:b.hp,description,abilities:{...a}};
});}
export function balanceCatalogue(){return {heroes:HEROES.map(h=>({...h,faces:HERO_DICE[h.id]})),foes:FOES,abilityLabels:ABILITY_LABELS,content:CONTENT_ROWS,defaults:defaultBalance()};}
// Only disk files with the exact old schema are migrated. PUT requests must use the new schema.
export function loadBalance(input:unknown):Balance {
  const root=object(input,'Баланс');
  if(Object.keys(root).length===3&&['revision','heroes','foes'].every(k=>Object.hasOwn(root,k)))return validateBalance({...defaultContent(),...root});
  return validateBalance(root);
}
export class BalanceStore {
  private current:Balance;
  constructor(private readonly file:string){this.current=existsSync(file)?loadBalance(JSON.parse(readFileSync(file,'utf8'))):defaultBalance();}
  snapshot():Balance{return structuredClone(this.current);}
  save(input:unknown):Balance {
    const value=validateBalance(input);if(value.revision!==this.current.revision)throw new BalanceConflict('Баланс уже изменён. Обновите страницу перед сохранением.');
    value.revision++;mkdirSync(dirname(this.file),{recursive:true,mode:0o700});
    if(existsSync(this.file))this.atomic(this.file+'.bak',readFileSync(this.file,'utf8'));
    this.atomic(this.file,JSON.stringify(value,null,2)+'\n');this.current=value;return this.snapshot();
  }
  private atomic(file:string,content:string){const tmp=file+'.'+randomUUID()+'.tmp';try{writeFileSync(tmp,content,{mode:0o600,flag:'wx',flush:true});renameSync(tmp,file);}finally{if(existsSync(tmp))unlinkSync(tmp);}}
}
