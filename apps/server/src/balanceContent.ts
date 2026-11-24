import type { ArtifactCard } from '@samopalka/shared';
import { ARTIFACTS } from './artifacts.js';
import { HERO_SPELLS, ARTIFACT_SPELLS, SPELL_ARTIFACT_CARDS, SPELL_PASSIVE_CARDS, type SpellDefinition } from './spells.js';

export type NumericField = { key:string; label:string; value:number; min:number; max:number };
export type ContentRow = {id:string; name:string; description:string; group:string; tier:number|null; fields:NumericField[]};
export type NumericRows = Record<string,Record<string,number>>;
export type ContentBalance = {artifacts:NumericRows; spells:NumericRows; effects:NumericRows};
const field=(key:string,label:string,value:number,min=0,max=100):NumericField=>({key,label,value,min,max});
const passiveFields:Record<string,NumericField[]>={
  'spellpassive-026':[field('amount','HP за каждое заклинание',1)],
  'spellpassive-138':[field('amount','Сила ответного удара',1)],
  'spellpassive-341':[field('amount','Щит за каждое заклинание',3)],
  'spellpassive-348':[field('amount','Скидка за каждое предыдущее заклинание',1)],
};
const wordLabels:Record<string,string>={strike:'Урон',shield:'Щит',heal:'Лечение',strengthen:'Усиление',poison:'Яд',weakness:'Слабость',pain:'Боль',taunt:'Насмешка',execute:'Порог казни (HP)',cleanse:'Очки очищения',maxhp:'Максимальное HP',painFaces:'Боль на гранях',healFaces:'Самолечение',nextMana:'Мана в следующий ход',regeneration:'Регенерация',dodge:'Уворот',immortal:'Заряды бессмертия',sethp:'Установить HP',revive:'HP при воскрешении',extraTurn:'Дополнительные ходы',kill:'Уничтожение'};
const groupLabels:Record<string,string>={selected:'цель',self:'сам',allHeroes:'все герои',allMonsters:'все монстры',allEntities:'все сущности',allWounded:'все раненые'};
const spellDefs=[...HERO_SPELLS,...ARTIFACT_SPELLS];
const artifactDefs=[...ARTIFACTS,...SPELL_ARTIFACT_CARDS,...SPELL_PASSIVE_CARDS];
export const ARTIFACT_ROWS:ContentRow[]=artifactDefs.map(a=>({id:a.id,name:a.title,description:a.description,group:a.group,tier:a.tier,fields:a.face?[field('faceValue','Сила грани',a.face.value)]:a.kind==='doubleface'?[field('amount','Множитель грани',a.amount??2,1,10)]:a.amount!==undefined?[field('amount',a.kind==='consumable'?'Лечение (HP)':a.kind==='buffall'?'Бонус ко всем граням':'Бонус HP',a.amount)]:passiveFields[a.id]??[]}));
export const SPELL_ROWS:ContentRow[]=spellDefs.map(s=>({id:s.id,name:s.title,description:s.description,group:s.artifactId?(artifactDefs.find(a=>a.id===s.artifactId)?.group??'Артефакты'):'Врождённые',tier:s.artifactId?(artifactDefs.find(a=>a.id===s.artifactId)?.tier??null):null,fields:[field('cost','Стоимость маны',s.cost,1),...s.parts.flatMap((p,i)=>['taunt','kill','painFaces'].includes(p.word)?[]:[field('part'+i,`${wordLabels[p.word]} · ${groupLabels[p.group]}`,p.amount,['sethp','revive'].includes(p.word)?1:0,p.word==='extraTurn'?5:100)]),...(s.killMana!==undefined?[field('killMana','Мана за уничтожение цели',s.killMana)]:[]),...(s.repeatCost?[field('repeatDiscount','Скидка за каждое повторение',1)]:[])]}));
export const EFFECT_ROWS:ContentRow[]=[
  {id:'poison',name:'Яд',description:'Урон в конце собственного хода. По-прежнему игнорирует броню, щит и прочность; отменяется регенерацией.',group:'Общие эффекты',tier:null,fields:[field('factor','Урон за единицу Яда',1,0,10)]},
  {id:'regeneration',name:'Регенерация',description:'Лечение в начале собственного хода, после взаимной отмены с Ядом.',group:'Общие эффекты',tier:null,fields:[field('factor','Лечение за единицу Регенерации',1,0,10)]},
  {id:'weakness',name:'Слабость',description:'Снижает силу грани до минимума 0. Снимается после хода.',group:'Общие эффекты',tier:null,fields:[field('factor','Снижение за единицу Слабости',1,0,10)]},
  {id:'growth',name:'Рост',description:'Прибавка к грани героя после использования. У монстров индивидуальный параметр в их карточках.',group:'Общие эффекты',tier:null,fields:[field('step','Прибавка к грани героя',1,0,10)]},
  {id:'decay',name:'Гниение',description:'Снижение грани героя после использования, не ниже 0. У монстров индивидуальный параметр.',group:'Общие эффекты',tier:null,fields:[field('step','Снижение грани героя',1,0,10)]},
  {id:'paralysis',name:'Паралич',description:'Боль при использовании грани героя. Сам статус остаётся бинарным.',group:'Общие эффекты',tier:null,fields:[field('factor','Множитель боли от грани',1,0,10)]},
];
export const CONTENT_ROWS={artifacts:ARTIFACT_ROWS,spells:SPELL_ROWS,effects:EFFECT_ROWS};
export function defaultContent():ContentBalance {const rows=(xs:ContentRow[])=>Object.fromEntries(xs.map(x=>[x.id,Object.fromEntries(x.fields.map(f=>[f.key,f.value]))]));return {artifacts:rows(ARTIFACT_ROWS),spells:rows(SPELL_ROWS),effects:rows(EFFECT_ROWS)};}
export type BalancedSpell = SpellDefinition & {repeatDiscount?:number;modified?:boolean};
export function effectiveSpells(b:ContentBalance):BalancedSpell[]{return spellDefs.map(s=>{const values=b.spells[s.id]!;const row=SPELL_ROWS.find(r=>r.id===s.id)!;const changed=row.fields.some(f=>values[f.key]!==f.value);const parts=s.parts.map((p,i)=>({...p,amount:values['part'+i]??p.amount}));const details=parts.map(p=>`${wordLabels[p.word]}${['taunt','kill','painFaces'].includes(p.word)?'':` ${p.amount}`} (${groupLabels[p.group]})`).join('; ');return {...s,cost:values.cost!,parts,...(s.killMana!==undefined?{killMana:values.killMana}:{}),...(s.repeatCost?{repeatDiscount:values.repeatDiscount}:{}),...(changed?{modified:true,title:`✧ ${details}`,description:`Стоимость: ${values.cost} маны. ${details}.${s.killMana!==undefined?` Мана за уничтожение: ${values.killMana}.`:''}${s.repeatCost?` Скидка за повтор: ${values.repeatDiscount}, минимум 1.`:''} Исходное правило: ${s.description}`}:{})};});}
export function effectiveArtifacts(b:ContentBalance,spells=effectiveSpells(b)):ArtifactCard[]{return artifactDefs.map(a=>{const values=b.artifacts[a.id]!;const row=ARTIFACT_ROWS.find(r=>r.id===a.id)!;const changed=row.fields.some(f=>values[f.key]!==f.value);const card={...a,...(a.face?{face:{...a.face,value:values.faceValue!,label:values.faceValue===a.face.value?a.face.label:a.face.label.replace(/\d+(?!.*\d)/,String(values.faceValue))}}:{}),...(a.amount!==undefined||values.amount!==undefined?{amount:values.amount}:{})};if(changed){card.title=a.face?`Грань · ${card.face!.label}`:a.title+' · баланс';card.description=row.fields.map(f=>`${f.label}: ${values[f.key]}`).join('; ')+'. Исходная карта: '+a.description;}if(a.kind==='spell'){const variants=spells.filter(s=>s.artifactId===a.id);if(variants.some(s=>s.modified)){card.description=variants.map(s=>s.description).join('\n');card.title='Заклинание · '+variants.map(s=>s.title.replace(/^✧ /,'')).join(' / ');}}return card;});}
