/** Spell catalog transcribed from workbook «Самопалка 4.0», worksheet «Артефакты».
 * spellcard-NNN = spell on original worksheet row NNN-1 (separate namespace from old artifact IDs).
 * Spell strength is fixed; cube face bonuses do not modify spell power. */
import type { ArtifactCard } from '@samopalka/shared';
export type SpellTarget = 'one'|'enemy'|'hero'|'deadHero'|'self'|'none';
export type SpellGroup = 'selected'|'self'|'allHeroes'|'allMonsters'|'allEntities'|'allWounded';
export type SpellWord = 'strike'|'shield'|'heal'|'strengthen'|'poison'|'weakness'|'pain'|'taunt'|'execute'|'cleanse'|'maxhp'|'painFaces'|'healFaces'|'nextMana'|'regeneration'|'dodge'|'immortal'|'sethp'|'revive'|'extraTurn'|'kill';
export type SpellPart = {word:SpellWord;amount:number;group:SpellGroup};
export type SpellDefinition = {
  id:string; artifactId:string|null; title:string;description:string;cost:number;
  target:SpellTarget;parts:SpellPart[];
  ranged?:boolean;scatter?:boolean;once?:boolean;preempt?:boolean;steel?:boolean;
  killMana?:number;repeatCost?:boolean;note?:string;
};
export const HERO_SPELLS:SpellDefinition[]=[
  {id:'hero-healer-set6',artifactId:null,title:'Жизнь до 6',description:'2 маны: установить текущее HP выбранного героя ровно в 6, не выше максимального.',cost:2,target:'hero',parts:[{word:'sethp',amount:6,group:'selected'}]},
  {id:'hero-adept-strike2',artifactId:null,title:'Удар 2',description:'2 маны: Удар 2 по доступной цели.',cost:2,target:'one',parts:[{word:'strike',amount:2,group:'selected'}]},
  {id:'hero-adept-shield2',artifactId:null,title:'Щит 2',description:'2 маны: Щит 2 на доступную цель.',cost:2,target:'one',parts:[{word:'shield',amount:2,group:'selected'}]},
];
export const ARTIFACT_SPELLS:SpellDefinition[]=[
  {"id":"spell-spellcard-009","artifactId":"spellcard-009","title":"✧ СамоЛечение, 2","description":"1 мана: СамоЛечение, 2; один раз за ход","cost":1,"target":"self","parts":[{"word":"heal","amount":2,"group":"selected"}],"once":true} as SpellDefinition,
  {"id":"spell-spellcard-010","artifactId":"spellcard-010","title":"✧ СамоУсиление, 1","description":"1 мана: СамоУсиление, 1; один раз за ход","cost":1,"target":"self","parts":[{"word":"strengthen","amount":1,"group":"selected"}],"once":true} as SpellDefinition,
  {"id":"spell-spellcard-011","artifactId":"spellcard-011","title":"✧ Удар, Яд, Слабость, 1","description":"1 мана: Удар, Яд, Слабость, 1; один раз за ход","cost":1,"target":"one","parts":[{"word":"strike","amount":1,"group":"selected"},{"word":"poison","amount":1,"group":"selected"},{"word":"weakness","amount":1,"group":"selected"}],"once":true} as SpellDefinition,
  {"id":"spell-spellcard-024","artifactId":"spellcard-024","title":"✧ Насмешка, Дальность","description":"1 мана: Насмешка, Дальность","cost":1,"target":"enemy","parts":[{"word":"taunt","amount":0,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-025","artifactId":"spellcard-025","title":"✧ Удар, Сталь, 0","description":"1 мана: Удар, Сталь, 0; один раз за ход","cost":1,"target":"one","parts":[{"word":"strike","amount":0,"group":"selected"}],"steel":true,"once":true} as SpellDefinition,
  {"id":"spell-spellcard-039","artifactId":"spellcard-039","title":"✧ Лечение, Боль, 2","description":"1 мана: Лечение, Боль, 2","cost":1,"target":"one","parts":[{"word":"heal","amount":2,"group":"selected"},{"word":"pain","amount":2,"group":"self"}]} as SpellDefinition,
  {"id":"spell-spellcard-040","artifactId":"spellcard-040","title":"✧ Усиление, 1","description":"2 маны: Усиление, 1; один раз за ход","cost":2,"target":"one","parts":[{"word":"strengthen","amount":1,"group":"selected"}],"once":true} as SpellDefinition,
  {"id":"spell-spellcard-054","artifactId":"spellcard-054","title":"✧ Казнь, Дальность, 1","description":"1 мана: Казнь, Дальность, 1; получите 3 маны за уничтожение цели; один раз за ход","cost":1,"target":"enemy","parts":[{"word":"execute","amount":1,"group":"selected"}],"ranged":true,"once":true,"killMana":3} as SpellDefinition,
  {"id":"spell-spellcard-055","artifactId":"spellcard-055","title":"✧ Удар, 3","description":"1 мана: Удар, 3; Боль, 2","cost":1,"target":"one","parts":[{"word":"strike","amount":3,"group":"selected"},{"word":"pain","amount":2,"group":"self"}]} as SpellDefinition,
  {"id":"spell-spellcard-056","artifactId":"spellcard-056","title":"✧ Удар, Все, 1","description":"1 мана: Удар, Все, 1","cost":1,"target":"none","parts":[{"word":"strike","amount":1,"group":"allEntities"}]} as SpellDefinition,
  {"id":"spell-spellcard-094","artifactId":"spellcard-094","title":"✧ Щит, Усиление, 1","description":"1 мана: Щит, Усиление, 1; один раз за ход","cost":1,"target":"one","parts":[{"word":"shield","amount":1,"group":"selected"},{"word":"strengthen","amount":1,"group":"selected"}],"once":true} as SpellDefinition,
  {"id":"spell-spellcard-095","artifactId":"spellcard-095","title":"✧ Щит, Очищение, 2","description":"2 маны: Щит, Очищение, 2","cost":2,"target":"one","parts":[{"word":"shield","amount":2,"group":"selected"},{"word":"cleanse","amount":2,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-109","artifactId":"spellcard-109","title":"✧ Лечение, 1 или Удар, 1","description":"1 мана: Лечение, 1 или Удар, 1","cost":1,"target":"one","parts":[{"word":"heal","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-109-strike","artifactId":"spellcard-109","title":"✧ Удар 1","description":"1 мана: Лечение, 1 или Удар, 1","cost":1,"target":"one","parts":[{"word":"strike","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-110","artifactId":"spellcard-110","title":"✧ Лечение, Все герои, 1","description":"2 маны: Лечение, Все герои, 1","cost":2,"target":"none","parts":[{"word":"heal","amount":1,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-111","artifactId":"spellcard-111","title":"✧ Лечение, Очищение, 2","description":"2 маны: Лечение, Очищение, 2","cost":2,"target":"one","parts":[{"word":"heal","amount":2,"group":"selected"},{"word":"cleanse","amount":2,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-112","artifactId":"spellcard-112","title":"✧ Лечение, Жир, 4","description":"3 маны: Лечение, Жир, 4","cost":3,"target":"one","parts":[{"word":"heal","amount":4,"group":"selected"},{"word":"maxhp","amount":4,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-124","artifactId":"spellcard-124","title":"✧ Удар, Все раненые, 2","description":"2 маны: Удар, Все раненые, 2","cost":2,"target":"none","parts":[{"word":"strike","amount":2,"group":"allWounded"}]} as SpellDefinition,
  {"id":"spell-spellcard-125","artifactId":"spellcard-125","title":"✧ Удар, Слабость, 1","description":"2 маны: Удар, Слабость, 1","cost":2,"target":"one","parts":[{"word":"strike","amount":1,"group":"selected"},{"word":"weakness","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-126","artifactId":"spellcard-126","title":"✧ Цель получает \"Боль\" ко всем сторонам на 1 ход","description":"2 маны: Цель получает \"Боль\" ко всем сторонам на 1 ход","cost":2,"target":"one","parts":[{"word":"painFaces","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-127","artifactId":"spellcard-127","title":"✧ Казнь, Дальность, 4","description":"3 маны: Казнь, Дальность, 4","cost":3,"target":"enemy","parts":[{"word":"execute","amount":4,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-128","artifactId":"spellcard-128","title":"✧ Удар, Все монстры, 1","description":"3 маны: Удар, Все монстры, 1","cost":3,"target":"none","parts":[{"word":"strike","amount":1,"group":"allMonsters"}]} as SpellDefinition,
  {"id":"spell-spellcard-164","artifactId":"spellcard-164","title":"✧ Щит, 6","description":"3 маны: Щит, 6","cost":3,"target":"one","parts":[{"word":"shield","amount":6,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-179","artifactId":"spellcard-179","title":"✧ Все герои получают \"Самолечение\" на все стороны на 1 ход","description":"2 маны: Все герои получают \"Самолечение\" на все стороны на 1 ход","cost":2,"target":"none","parts":[{"word":"healFaces","amount":1,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-180","artifactId":"spellcard-180","title":"✧ Лечение, Щит, Разброс, 1","description":"2 маны: Лечение, Щит, Разброс, 1","cost":2,"target":"one","parts":[{"word":"heal","amount":1,"group":"selected"},{"word":"shield","amount":1,"group":"selected"}],"scatter":true} as SpellDefinition,
  {"id":"spell-spellcard-181","artifactId":"spellcard-181","title":"✧ Лечение, 3. 2 маны за второе применение. 1 мана за третье и последу…","description":"3 маны: Лечение, 3. 2 маны за второе применение. 1 мана за третье и последующие применения. Стоимость сбрасывается на следующий ход","cost":3,"target":"one","parts":[{"word":"heal","amount":3,"group":"selected"}],"repeatCost":true} as SpellDefinition,
  {"id":"spell-spellcard-194","artifactId":"spellcard-194","title":"✧ Удар, Дальность, Упреждение, 2","description":"2 маны: Удар, Дальность, Упреждение, 2","cost":2,"target":"one","parts":[{"word":"strike","amount":2,"group":"selected"}],"ranged":true,"preempt":true} as SpellDefinition,
  {"id":"spell-spellcard-195","artifactId":"spellcard-195","title":"✧ Получите 4 маны в следующем ходу","description":"3 маны: Получите 4 маны в следующем ходу","cost":3,"target":"self","parts":[{"word":"nextMana","amount":4,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-196","artifactId":"spellcard-196","title":"✧ Удар, Разброс, 2","description":"3 маны: Удар, Разброс, 2","cost":3,"target":"one","parts":[{"word":"strike","amount":2,"group":"selected"}],"scatter":true} as SpellDefinition,
  {"id":"spell-spellcard-197","artifactId":"spellcard-197","title":"✧ Удар, Разброс, Слабость, 1","description":"3 маны: Удар, Разброс, Слабость, 1","cost":3,"target":"one","parts":[{"word":"strike","amount":1,"group":"selected"},{"word":"weakness","amount":1,"group":"selected"}],"scatter":true} as SpellDefinition,
  {"id":"spell-spellcard-198","artifactId":"spellcard-198","title":"✧ Удар, Все монстры, 1","description":"4 маны: Удар, Все монстры, 1; Щит, Все герои, 1","cost":4,"target":"none","parts":[{"word":"strike","amount":1,"group":"allMonsters"},{"word":"shield","amount":1,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-199","artifactId":"spellcard-199","title":"✧ Удар, Дальность, 6","description":"4 маны: Удар, Дальность, 6","cost":4,"target":"one","parts":[{"word":"strike","amount":6,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-234","artifactId":"spellcard-234","title":"✧ СамоЩит, 2","description":"1 маны: СамоЩит, 2; Насмешка, Дальность","cost":1,"target":"enemy","parts":[{"word":"shield","amount":2,"group":"self"},{"word":"taunt","amount":0,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-235","artifactId":"spellcard-235","title":"✧ Щит, Все герои, 2","description":"3 маны: Щит, Все герои, 2","cost":3,"target":"none","parts":[{"word":"shield","amount":2,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-249","artifactId":"spellcard-249","title":"✧ Лечение, 2","description":"1 мана: Лечение, 2","cost":1,"target":"one","parts":[{"word":"heal","amount":2,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-250","artifactId":"spellcard-250","title":"✧ Лечение, Все герои, 2","description":"3 маны: Лечение, Все герои, 2","cost":3,"target":"none","parts":[{"word":"heal","amount":2,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-251","artifactId":"spellcard-251","title":"✧ Удар, Все монстры, 1","description":"3 маны: Удар, Все монстры, 1; Лечение, Все герои, 1","cost":3,"target":"none","parts":[{"word":"strike","amount":1,"group":"allMonsters"},{"word":"heal","amount":1,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-264","artifactId":"spellcard-264","title":"✧ Удар, 3. 2 маны за второе применение. 1 маны за третье и последующи…","description":"3 маны: Удар, 3. 2 маны за второе применение. 1 маны за третье и последующие применения. Стоимость сбрасывается на следующий ход","cost":3,"target":"one","parts":[{"word":"strike","amount":3,"group":"selected"}],"repeatCost":true} as SpellDefinition,
  {"id":"spell-spellcard-265","artifactId":"spellcard-265","title":"✧ Удар, 4","description":"3 маны: Удар, 4","cost":3,"target":"one","parts":[{"word":"strike","amount":4,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-266","artifactId":"spellcard-266","title":"✧ Удар, Яд, 2","description":"3 маны: Удар, Яд, 2","cost":3,"target":"one","parts":[{"word":"strike","amount":2,"group":"selected"},{"word":"poison","amount":2,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-267","artifactId":"spellcard-267","title":"✧ Удар, Все монстры, Слабость, 1","description":"5 маны: Удар, Все монстры, Слабость, 1","cost":5,"target":"none","parts":[{"word":"strike","amount":1,"group":"allMonsters"},{"word":"weakness","amount":1,"group":"allMonsters"}]} as SpellDefinition,
  {"id":"spell-spellcard-268","artifactId":"spellcard-268","title":"✧ Удар, 14","description":"6 маны: Удар, 14","cost":6,"target":"one","parts":[{"word":"strike","amount":14,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-304","artifactId":"spellcard-304","title":"✧ Лечение, Щит, 3","description":"2 маны: Лечение, Щит, 3","cost":2,"target":"one","parts":[{"word":"heal","amount":3,"group":"selected"},{"word":"shield","amount":3,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-305","artifactId":"spellcard-305","title":"✧ Бессмертие, Дальность","description":"3 маны: Бессмертие, Дальность","cost":3,"target":"hero","parts":[{"word":"immortal","amount":1,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-319","artifactId":"spellcard-319","title":"✧ Установить здоровье героя =9, но не больше максимального запаса, Да…","description":"2 маны: Установить здоровье героя =9, но не больше максимального запаса, Дальность","cost":2,"target":"hero","parts":[{"word":"sethp","amount":9,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-320","artifactId":"spellcard-320","title":"✧ Лечение, Все герои, Очищение, 2","description":"4 маны: Лечение, Все герои, Очищение, 2","cost":4,"target":"none","parts":[{"word":"heal","amount":2,"group":"allHeroes"},{"word":"cleanse","amount":2,"group":"allHeroes"}]} as SpellDefinition,
  {"id":"spell-spellcard-321","artifactId":"spellcard-321","title":"✧ Лечение, Дальность, Очищение, 15","description":"4 маны: Лечение, Дальность, Очищение, 15","cost":4,"target":"one","parts":[{"word":"heal","amount":15,"group":"selected"},{"word":"cleanse","amount":15,"group":"selected"}],"ranged":true} as SpellDefinition,
  {"id":"spell-spellcard-322","artifactId":"spellcard-322","title":"✧ Лечение, Разброс, Регенерация, 1","description":"4 маны: Лечение, Разброс, Регенерация, 1","cost":4,"target":"one","parts":[{"word":"heal","amount":1,"group":"selected"},{"word":"regeneration","amount":1,"group":"selected"}],"scatter":true} as SpellDefinition,
  {"id":"spell-spellcard-323","artifactId":"spellcard-323","title":"✧ Уворот, Все герои","description":"5 маны: Уворот, Все герои","cost":5,"target":"none","parts":[{"word":"dodge","amount":1,"group":"allHeroes"}],"note":"В таблице не указано число уворотов; временно используется 1."} as SpellDefinition,
  {"id":"spell-spellcard-324","artifactId":"spellcard-324","title":"✧ Воскрешение, 1","description":"6 маны: Воскрешение, 1","cost":6,"target":"deadHero","parts":[{"word":"revive","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-335","artifactId":"spellcard-335","title":"✧ Удар, 3 или Щит, 3","description":"2 маны: Удар, 3 или Щит, 3","cost":2,"target":"one","parts":[{"word":"strike","amount":3,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-335-shield","artifactId":"spellcard-335","title":"✧ Щит 3","description":"2 маны: Удар, 3 или Щит, 3","cost":2,"target":"one","parts":[{"word":"shield","amount":3,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-336","artifactId":"spellcard-336","title":"✧ Удар, Яд, Разброс, 1","description":"4 маны: Удар, Яд, Разброс, 1","cost":4,"target":"one","parts":[{"word":"strike","amount":1,"group":"selected"},{"word":"poison","amount":1,"group":"selected"}],"scatter":true} as SpellDefinition,
  {"id":"spell-spellcard-337","artifactId":"spellcard-337","title":"✧ Удар, Все монстры, 2","description":"4 маны: Удар, Все монстры, 2","cost":4,"target":"none","parts":[{"word":"strike","amount":2,"group":"allMonsters"}]} as SpellDefinition,
  {"id":"spell-spellcard-338","artifactId":"spellcard-338","title":"✧ Цель ходит дважды ход в свой ход","description":"6 маны: Цель ходит дважды ход в свой ход","cost":6,"target":"hero","parts":[{"word":"extraTurn","amount":1,"group":"selected"}]} as SpellDefinition,
  {"id":"spell-spellcard-339","artifactId":"spellcard-339","title":"✧ Убить цель","description":"8 маны: Убить цель","cost":8,"target":"one","parts":[{"word":"kill","amount":0,"group":"selected"}]} as SpellDefinition,
];
const SPELL_TIER:Record<string,{tier:number;group:string}>={
  'spellcard-009':{tier:1,group:"Воин"},
  'spellcard-010':{tier:1,group:"Воин"},
  'spellcard-011':{tier:1,group:"Воин"},
  'spellcard-024':{tier:1,group:"Защ"},
  'spellcard-025':{tier:1,group:"Защ"},
  'spellcard-039':{tier:1,group:"Леч"},
  'spellcard-040':{tier:1,group:"Леч"},
  'spellcard-054':{tier:1,group:"Маг"},
  'spellcard-055':{tier:1,group:"Маг"},
  'spellcard-056':{tier:1,group:"Маг"},
  'spellcard-094':{tier:2,group:"Защ"},
  'spellcard-095':{tier:2,group:"Защ"},
  'spellcard-109':{tier:2,group:"Леч"},
  'spellcard-110':{tier:2,group:"Леч"},
  'spellcard-111':{tier:2,group:"Леч"},
  'spellcard-112':{tier:2,group:"Леч"},
  'spellcard-124':{tier:2,group:"Маг"},
  'spellcard-125':{tier:2,group:"Маг"},
  'spellcard-126':{tier:2,group:"Маг"},
  'spellcard-127':{tier:2,group:"Маг"},
  'spellcard-128':{tier:2,group:"Маг"},
  'spellcard-164':{tier:3,group:"Защ"},
  'spellcard-179':{tier:3,group:"Леч"},
  'spellcard-180':{tier:3,group:"Леч"},
  'spellcard-181':{tier:3,group:"Леч"},
  'spellcard-194':{tier:3,group:"Маг"},
  'spellcard-195':{tier:3,group:"Маг"},
  'spellcard-196':{tier:3,group:"Маг"},
  'spellcard-197':{tier:3,group:"Маг"},
  'spellcard-198':{tier:3,group:"Маг"},
  'spellcard-199':{tier:3,group:"Маг"},
  'spellcard-234':{tier:4,group:"Защ"},
  'spellcard-235':{tier:4,group:"Защ"},
  'spellcard-249':{tier:4,group:"Леч"},
  'spellcard-250':{tier:4,group:"Леч"},
  'spellcard-251':{tier:4,group:"Леч"},
  'spellcard-264':{tier:4,group:"Маг"},
  'spellcard-265':{tier:4,group:"Маг"},
  'spellcard-266':{tier:4,group:"Маг"},
  'spellcard-267':{tier:4,group:"Маг"},
  'spellcard-268':{tier:4,group:"Маг"},
  'spellcard-304':{tier:5,group:"Защ"},
  'spellcard-305':{tier:5,group:"Защ"},
  'spellcard-319':{tier:5,group:"Леч"},
  'spellcard-320':{tier:5,group:"Леч"},
  'spellcard-321':{tier:5,group:"Леч"},
  'spellcard-322':{tier:5,group:"Леч"},
  'spellcard-323':{tier:5,group:"Леч"},
  'spellcard-324':{tier:5,group:"Леч"},
  'spellcard-335':{tier:5,group:"Маг"},
  'spellcard-336':{tier:5,group:"Маг"},
  'spellcard-337':{tier:5,group:"Маг"},
  'spellcard-338':{tier:5,group:"Маг"},
  'spellcard-339':{tier:5,group:"Маг"},
};

export const SPELL_ARTIFACT_CARDS: ArtifactCard[] = ARTIFACT_SPELLS
  .filter((spell,index,list)=>list.findIndex(x=>x.artifactId===spell.artifactId)===index)
  .map(spell=>({id:spell.artifactId!,title:`Заклинание · ${spell.title.replace(/^✧ /,'')}`,description:spell.description,
    tier:SPELL_TIER[spell.artifactId!]!.tier,group:SPELL_TIER[spell.artifactId!]!.group,kind:'spell'}));

/** Six additional artifacts that react to or modify spellcasting. */
export const SPELL_PASSIVE_CARDS: ArtifactCard[] = [
  {
    "id": "spellpassive-026",
    "title": "✧ Лечение за заклинания",
    "description": "Даёт вам \"Лечение, 1\" за каждое произнесенное на столе заклинание",
    "group": "Защ",
    "tier": 1,
    "kind": "spellpassive"
  },
  {
    "id": "spellpassive-138",
    "title": "✧ Удар после заклинания",
    "description": "После каждого произнесенного вами заклинания, можете применить \"Удар, 1\"",
    "group": "Маг",
    "tier": 2,
    "kind": "spellpassive"
  },
  {
    "id": "spellpassive-278",
    "title": "✧ Бесплатное заклинание (расходуется)",
    "description": "Можете один раз бесплатно произнести заклинание в ваш ход. Затем сбросьте этот артефакт",
    "group": "Маг",
    "tier": 4,
    "kind": "spellpassive"
  },
  {
    "id": "spellpassive-341",
    "title": "✧ Щит за заклинания",
    "description": "Даёт вам \"Щит, 3\" за каждое произнесенное заклинание",
    "group": "Маг",
    "tier": 5,
    "kind": "spellpassive"
  },
  {
    "id": "spellpassive-346",
    "title": "✧ Бесплатное заклинание после паузы",
    "description": "Можете один раз бесплатно произнести заклинание в ваш ход, если вы не колдовали прошлый ход",
    "group": "Маг",
    "tier": 5,
    "kind": "spellpassive"
  },
  {
    "id": "spellpassive-348",
    "title": "✧ Удешевление следующих заклинаний",
    "description": "Стоимость каждого следующего применяемого заклинания уменьшается на 1, но не меньше 1 маны. Стоимость сбрасывается на следующий ход.",
    "group": "Маг",
    "tier": 5,
    "kind": "spellpassive"
  }
];
