import { randomInt } from 'node:crypto';
import { HEROES, HERO_DICE, type BattleSnapshot, type BattleEvent, type HeroId, type CombatantSnapshot, type PendingAction, type BattleVisual, type DiceFace } from '@samopalka/shared';
import { FOES, type FoeDefinition } from './foes.js';
import { printedFoeAction, statusValue, addEffect, clearEffect, consumeEffect, armorFor, hasFoeTrait } from './effectRules.js';

export class BattleError extends Error {}

export function turnDurations(env: Record<string, string | undefined> = process.env) {
  const seconds = (key: string, fallback: number) => {
    const raw = env[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 600 ? parsed : fallback;
  };
  return { normalMs: seconds('TURN_SECONDS', 60) * 1000, shortMs: seconds('SHORT_TURN_SECONDS', 60) * 1000 };
}

/**
 * Stage 3.3: server-authoritative word effects. Printed enemy actions use their
 * actual dice value and named words, not a generic demo strike.  The dynamic
 * cube editing/artifact system is reserved for stage 3.4.
 */
export class BattleSession {
  private playerIds: string[];
  private readonly originalPlayerCount: number;
  private heroes: Map<string, HeroId>;
  private combatants = new Map<string, CombatantSnapshot>();
  private foeDefinitions = new Map<string, FoeDefinition>();
  private activeIndex = 0;
  private phase: BattleSnapshot['phase'] = 'roll';
  private deadlineAt: number | null = null;
  private dice: [number, number] | null = null;
  private pendingAction: PendingAction | null = null;
  private events: BattleEvent[] = [];
  private consecutiveMisses = new Map<string, number>();
  private floor = 1;
  private round = 1;
  private absent = new Set<string>();
  private eventId = 0;
  private result: BattleSnapshot['result'] = null;
  private pendingMonsterTurn: string | null = null;
  private readonly enemyPauseMs = 500;
  private readonly durations = turnDurations();
  private summonSerial = 0;
  private hitUntilTurn = new Set<string>(); // «Бесплотность» / first successful strike
  private lichSummoned = false;
  private petrifiedFaces = new Map<string,Set<number>>();
  private decayedFaces = new Map<string,Map<number,number>>();
  private debugFaceOverrides = new Map<string,DiceFace[]>();

  constructor(
    players: { id: string; heroId: HeroId }[],
    private readonly now: () => number = Date.now,
    private readonly die: () => number = () => randomInt(1, 7),
    private readonly pickIndex: (length: number) => number = length => randomInt(0, length)
  ) {
    this.playerIds = players.map(p => p.id);
    this.originalPlayerCount = players.length;
    this.heroes = new Map(players.map(p => [p.id,p.heroId]));
    for (const player of players) {
      const hero = HEROES.find(h => h.id === player.heroId);
      if (!hero) throw new BattleError('Неизвестный герой.');
      this.combatants.set(player.id, {
        id:player.id, kind:'hero', ownerId:player.id, name:hero.name,
        hp:hero.hp,maxHp:hero.hp,shield:0,mana:0,maxMana:3,alive:true,effects:[]
      });
    }
    this.setupEnemies();
    this.prepareTurn(true);
    this.log('Начало первого этажа. Слова, ответные атаки и состояния рассчитываются сервером.', 'system');
  }

  private log(text: string, kind: BattleEvent['kind']='system', visual?:BattleVisual) {
    this.events.push({id:++this.eventId,text,kind,...(visual?{visual}:{})});
    if (this.events.length>120) this.events.shift();
  }
  private drawFoe(pool:FoeDefinition[]):FoeDefinition {
    if(!pool.length) throw new BattleError(`Недостаточно карт противников для этажа ${this.floor}.`);
    const index=this.pickIndex(pool.length);
    if(!Number.isInteger(index)||index<0||index>=pool.length) throw new BattleError('Ошибка выбора противника.');
    return pool.splice(index,1)[0]!;
  }
  private actor(id:string){return this.combatants.get(id);}
  private livingHeroes(){return this.playerIds.filter(id=>this.actor(id)?.alive);}
  private livingEnemies(){return [...this.combatants.values()].filter(c=>c.kind!=='hero'&&c.alive);}
  activePlayer(){return this.playerIds[this.activeIndex]??null;}

  private spawnFoe(ownerId:string,def:FoeDefinition, id:string) {
    this.foeDefinitions.set(id,def);
    const foe:CombatantSnapshot={id,kind:'monster',ownerId,name:def.name,hp:def.hp,maxHp:def.hp,shield:0,mana:0,maxMana:0,alive:true,effects:[]};
    this.combatants.set(id,foe);
    if(def.name==='Тень' || hasFoeTrait(def,'Перед выходом: СамоУворот')) {
      addEffect(foe,'dodge',1);
      this.log(`${def.name}: уворот 1 при появлении.`, 'system',{type:'shield',targetId:id});
    }
  }
  private summon(ownerId:string, tier:number, label:string, depth=0){
    if(depth>1 || this.combatants.size>42) return;
    const pool=FOES.filter(f=>f.floor===tier&&!f.boss).flatMap(f=>Array.from({length:f.count},()=>f));
    if(!pool.length) return;
    const def=this.drawFoe(pool);
    const id=`monster:${this.floor}:${ownerId}:summon:${++this.summonSerial}`;
    this.spawnFoe(ownerId,def,id);
    this.log(`${label}: призван «${def.name}» перед героем.`, 'system',{type:'turn',targetId:id});
    if(/Перед выходом:\s*Призыв/iu.test(def.description)) this.summon(ownerId,1,def.name,depth+1);
  }
  private setupEnemies(){
    for(const [id,c] of [...this.combatants]) if(c.kind!=='hero') this.combatants.delete(id);
    this.foeDefinitions.clear();
    this.hitUntilTurn.clear();
    this.lichSummoned=false;
    const deck=FOES.filter(f=>f.floor===this.floor&&!f.boss).flatMap(f=>Array.from({length:f.count},()=>f));
    const bosses=FOES.filter(f=>f.floor===this.floor&&f.boss);
    const onEntry:{owner:string;def:FoeDefinition}[]=[];
    for(const ownerId of this.playerIds){
      const def=this.drawFoe(deck);
      const id=`monster:${this.floor}:${ownerId}`;
      this.spawnFoe(ownerId,def,id);
      if(/Перед выходом:\s*Призыв/iu.test(def.description)) onEntry.push({owner:ownerId,def});
    }
    const boss=this.drawFoe([...bosses]);
    this.foeDefinitions.set('boss',boss);
    this.combatants.set('boss',{id:'boss',kind:'boss',ownerId:null,name:boss.name,hp:boss.hp,maxHp:boss.hp,shield:0,mana:0,maxMana:0,alive:true,effects:[]});
    this.log(`Этаж ${this.floor}: босс «${boss.name}» и монстры перед героями.`, 'system');
    for(const {owner,def} of onEntry){
      const match=/монстра с\s*(\d+)[- ]?го этажа/iu.exec(def.description);
      this.summon(owner,Number(match?.[1]??1),def.name);
    }
  }
  private assertActive(playerId:string){
    if(!['roll','choose','target'].includes(this.phase)) throw new BattleError('Сейчас нельзя выполнять ход.');
    if(this.activePlayer()!==playerId) throw new BattleError('Сейчас ход другого игрока.');
    if(!this.actor(playerId)?.alive) throw new BattleError('Выбывший герой не может ходить.');
    if(this.deadlineAt===null||this.now()>=this.deadlineAt) throw new BattleError('Время хода истекло.');
  }
  private neighbors(id:string){
    const alive=this.livingHeroes();const index=alive.indexOf(id);
    if(index<0||alive.length<2)return [];
    return [...new Set([alive[(index-1+alive.length)%alive.length]!,alive[(index+1)%alive.length]!])];
  }
  private ownMonsters(id:string){return [...this.combatants.values()].filter(c=>c.kind==='monster'&&c.alive&&c.ownerId===id);}
  private isBehind(c:CombatantSnapshot){return c.kind!=='hero'&&(c.kind==='boss'||hasFoeTrait(this.foeDefinitions.get(c.id),'Позади:'));}
  private availableMonsters(playerId:string,anyRange=false){
    const near=new Set([playerId,...this.neighbors(playerId)]);
    return [...this.combatants.values()].filter(c=>{
      if(c.kind!=='monster'||!c.alive||(!anyRange && (!c.ownerId||!near.has(c.ownerId))))return false;
      // «Позади»: a front-rank enemy must be cleared first; distance ignores this.
      if(!anyRange&&this.isBehind(c)&&[...this.combatants.values()].some(other=>other.kind==='monster'&&other.alive&&other.ownerId===c.ownerId&&!this.isBehind(other)))return false;
      return true;
    }).map(c=>c.id);
  }
  private possibleTargets(id:string,action:PendingAction):string[]{
    if(!this.actor(id)?.alive)return [];
    const anyRange=action.label.toLocaleLowerCase('ru-RU').includes('дальность');
    const neighbors=this.neighbors(id);
    if(action.kind==='special'&&action.label.includes('Насмешка')) return this.availableMonsters(id);
    if(action.kind==='mana'||action.kind==='empty'||action.kind==='special')return [];
    if(action.kind==='heal'||action.kind==='shield')return [id,...neighbors].filter(x=>this.actor(x)?.alive);
    if(action.kind==='strike'){
      const monsterFree=this.ownMonsters(id).length===0;
      const longRange=anyRange||(!this.actor('boss')?.alive&&monsterFree);
      const foes=this.availableMonsters(id,longRange);
      const heroes=longRange?this.livingHeroes().filter(x=>x!==id):neighbors;
      const boss= (monsterFree||anyRange)&&this.actor('boss')?.alive?['boss']:[];
      return [...new Set([...foes,...boss,...heroes.filter(x=>x!==id&&this.actor(x)?.alive)])];
    }
    return [];
  }
  private faceFor(id:string,faceIndex:number):DiceFace{
    const heroId=this.heroes.get(id);
    if(!heroId)throw new BattleError('Неизвестный герой.');
    const base=(this.debugFaceOverrides.get(id) ?? HERO_DICE[heroId])[faceIndex];
    if(!base)throw new BattleError('У героя нет такой грани.');
    if(this.petrifiedFaces.get(id)?.has(faceIndex))return {kind:'empty',value:0,label:'Окаменение · Пусто'};
    return {...base};
  }
  private computedFaces(id:string):DiceFace[]{
    return Array.from({length:6},(_,index)=>{
      const face=this.faceFor(id,index);
      const weak=statusValue(this.actor(id)!, 'weakness');
      const decay=statusValue(this.actor(id)!, 'decay') ? (this.decayedFaces.get(id)?.get(index) ?? 0) : 0;
      const reduction=weak+decay;
      if(reduction && face.kind!=='empty')return {...face,value:Math.max(0,face.value-reduction),label:face.label+` (−${reduction})`};
      return face;
    });
  }
  snapshot():BattleSnapshot{
    return {
      floor:this.floor,round:this.round,activePlayerId:this.activePlayer(),phase:this.phase,
      deadlineAt:this.deadlineAt,serverTime:this.now(),rolls:this.dice?[...this.dice] as [number,number]:null,
      events:[...this.events],missedTurns:Object.fromEntries(this.consecutiveMisses),
      combatants:[...this.combatants.values()].map(c=>({...c,effects:c.effects?.map(e=>({...e}))??[]})),
      diceFaces:Object.fromEntries(this.playerIds.filter(id=>this.heroes.has(id)).map(id=>[id,this.computedFaces(id)])),
      pendingAction:this.pendingAction?{...this.pendingAction}:null,
      availableTargetIds:this.phase==='target'&&this.activePlayer()&&this.pendingAction?this.possibleTargets(this.activePlayer()!,this.pendingAction):[],
      result:this.result
    };
  }

  // Development-only commands. RoomManager checks both the DEBUG_TOOLS flag and
  // the room host's live socket before forwarding any of these mutations.
  private debugCombatant(id:unknown):CombatantSnapshot {
    if(typeof id!=='string') throw new BattleError('Укажите персонажа на поле.');
    const entity=this.actor(id);
    if(!entity) throw new BattleError('Персонаж не найден в текущем бою.');
    return entity;
  }
  private debugActiveBattle(){
    if(this.phase==='finished'||this.phase==='rest'||this.phase==='paused')
      throw new BattleError('Отладочные изменения доступны только во время боя.');
  }
  debugSetStat(input:unknown){
    this.debugActiveBattle();
    if(!input||typeof input!=='object')throw new BattleError('Неверные параметры.');
    const data=input as Record<string,unknown>;
    const entity=this.debugCombatant(data.id);
    const allowed=['hp','maxHp','shield','mana','maxMana'];
    if(!allowed.includes(String(data.field)))throw new BattleError('Неизвестная характеристика.');
    if(!Number.isInteger(data.value)||Number(data.value)<(data.field==='hp'||data.field==='maxHp'?1:0)||Number(data.value)>500)
      throw new BattleError('Значение должно быть целым числом в допустимых пределах.');
    if(!entity.alive)throw new BattleError('Нельзя изменять параметры погибшего персонажа.');
    const field=data.field as 'hp'|'maxHp'|'shield'|'mana'|'maxMana';
    const value=Number(data.value);
    if(field==='hp' && value>entity.maxHp)throw new BattleError('Здоровье не может превышать максимум.');
    entity[field]=value;
    if(field==='maxHp')entity.hp=Math.min(entity.hp,entity.maxHp);
    this.log(`[ТЕСТ] ${entity.name}: ${field} = ${value}.`,'system');
  }
  debugSetFace(input:unknown){
    this.debugActiveBattle();
    if(!input||typeof input!=='object')throw new BattleError('Неверные параметры.');
    const data=input as Record<string,unknown>;
    if(typeof data.playerId!=='string'||!this.heroes.has(data.playerId))throw new BattleError('Выберите героя.');
    if(!Number.isInteger(data.index)||Number(data.index)<0||Number(data.index)>5)throw new BattleError('Грань должна быть от 1 до 6.');
    const supported=['strike','heal','shield','mana','empty','dodge','taunt'];
    if(typeof data.word!=='string'||!supported.includes(data.word))throw new BattleError('Это слово пока нельзя установить на грань.');
    if(!Number.isInteger(data.value)||Number(data.value)<0||Number(data.value)>20)throw new BattleError('Значение грани — от 0 до 20.');
    const value=Number(data.value);
    if(data.word!=='empty'&&value===0)throw new BattleError('Значение слова должно быть больше нуля.');
    // No changing the active hero's dice after they have been rolled/selected.
    if(data.playerId===this.activePlayer()&&this.phase!=='roll')
      throw new BattleError('Менять грани активного героя можно до броска кубиков.');
    const faces=[...(this.debugFaceOverrides.get(data.playerId)??HERO_DICE[this.heroes.get(data.playerId)!])];
    const defs:Record<string,{kind:DiceFace['kind'];label:string}>={
      strike:{kind:'strike',label:`Удар ${value}`},
      heal:{kind:'heal',label:`Лечение ${value}`},
      shield:{kind:'shield',label:`Щит ${value}`},
      mana:{kind:'mana',label:`Мана ${value}`},
      empty:{kind:'empty',label:'Пусто'},
      dodge:{kind:'special',label:`СамоУворот ${value}`},
      taunt:{kind:'special',label:`Самощит ${value} + Насмешка`}
    };
    const def=defs[data.word]!;
    faces[Number(data.index)]={kind:def.kind,value:data.word==='empty'?0:value,label:def.label};
    this.debugFaceOverrides.set(data.playerId,faces);
    this.log(`[ТЕСТ] Грань ${Number(data.index)+1} изменена: ${def.label}.`,'system');
  }
  debugApplyStatus(input:unknown){
    this.debugActiveBattle();
    if(!input||typeof input!=='object')throw new BattleError('Неверные параметры.');
    const data=input as Record<string,unknown>;
    const entity=this.debugCombatant(data.id);
    if(!entity.alive)throw new BattleError('Нельзя накладывать эффект на погибшего персонажа.');
    const kinds=['poison','weakness','stun','sleep','paralysis','dodge','regeneration','decay'];
    if(typeof data.kind!=='string'||!kinds.includes(data.kind))throw new BattleError('Неизвестное состояние.');
    if(data.mode!=='add'&&data.mode!=='clear')throw new BattleError('Укажите действие с эффектом.');
    if(data.mode==='add'&&(!Number.isInteger(data.amount)||Number(data.amount)<1||Number(data.amount)>10))
      throw new BattleError('Сила эффекта: от 1 до 10.');
    const kind=data.kind as Parameters<typeof addEffect>[1];
    if(data.mode==='clear')clearEffect(entity,kind);
    else addEffect(entity,kind,Number(data.amount));
    this.log(`[ТЕСТ] ${entity.name}: ${data.mode==='clear'?'снят':'наложен'} эффект ${kind}${data.mode==='add'?' '+data.amount:''}.`,'system',{type:'mana',targetId:entity.id});
  }
  debugSetRoll(input:unknown){
    if(this.phase!=='roll'||!this.activePlayer())throw new BattleError('Бросок можно задать только до броска активного героя.');
    if(!input||typeof input!=='object')throw new BattleError('Неверные параметры.');
    const data=input as Record<string,unknown>;
    if(!Number.isInteger(data.first)||!Number.isInteger(data.second)||Number(data.first)<1||Number(data.first)>6||Number(data.second)<1||Number(data.second)>6)
      throw new BattleError('Значения кубиков: от 1 до 6.');
    this.dice=[Number(data.first),Number(data.second)];
    this.phase='choose';
    this.log(`[ТЕСТ] Выданы результаты: ${data.first} и ${data.second}.`,'dice');
  }
  debugReplaceFoe(input:unknown){
    this.debugActiveBattle();
    if(!input||typeof input!=='object')throw new BattleError('Неверные параметры.');
    const data=input as Record<string,unknown>;
    const entity=this.debugCombatant(data.id);
    if(entity.kind==='hero')throw new BattleError('Героя нельзя заменить монстром.');
    if(typeof data.foeId!=='string')throw new BattleError('Выберите противника.');
    const def=FOES.find(foe=>foe.id===data.foeId&&foe.boss===(entity.kind==='boss'));
    if(!def)throw new BattleError('Противник не найден в каталоге.');
    this.foeDefinitions.set(entity.id,def);
    entity.name=def.name;entity.maxHp=def.hp;entity.hp=def.hp;
    entity.alive=true;entity.shield=0;entity.mana=0;entity.effects=[];
    this.hitUntilTurn.delete(entity.id);
    if(def.name==='Тень'||hasFoeTrait(def,'Перед выходом: СамоУворот'))addEffect(entity,'dodge',1);
    this.log(`[ТЕСТ] ${entity.kind==='boss'?'Босс':'Монстр'} заменён на «${entity.name}» (${entity.hp} HP).`,'system',{type:'turn',targetId:entity.id});
  }
  debugExtendTurn(input:unknown){
    if(!['roll','choose','target'].includes(this.phase))throw new BattleError('Продлить можно только ход героя.');
    if(!Number.isInteger(input)||Number(input)<10||Number(input)>600)throw new BattleError('Добавьте от 10 до 600 секунд.');
    this.deadlineAt=Math.max(this.deadlineAt??this.now(),this.now())+Number(input)*1000;
    this.log(`[ТЕСТ] Таймер продлён на ${input} сек.`,'system');
  }

  roll(id:string,name:string){
    this.assertActive(id);
    if(this.phase!=='roll')throw new BattleError('Кубики уже брошены. Выберите результат.');
    const first=this.die(),second=this.die();
    if(![first,second].every(v=>Number.isInteger(v)&&v>=1&&v<=6))throw new BattleError('Ошибка броска кубиков.');
    this.dice=[first,second];this.phase='choose';
    this.log(`${name} бросает два кубика: ${first} и ${second}.`,'dice');
  }
  choose(id:string,index:unknown,name:string){
    this.assertActive(id);
    if(this.phase!=='choose'||!this.dice)throw new BattleError('Сначала бросьте кубики.');
    if(index!==0&&index!==1)throw new BattleError('Нужно выбрать один из двух кубиков.');
    const faceIndex=this.dice[index]-1;
    const face=this.computedFaces(id)[faceIndex];
    if(!face)throw new BattleError('У героя отсутствует выбранная грань.');
    this.log(`${name} выбирает «${face.label}» (грань ${faceIndex+1}).`,'action');
    this.pendingAction={kind:face.kind,value:face.value,label:face.label,faceIndex};
    if(face.kind==='special'){
      if(face.label.includes('СамоУворот')){
        addEffect(this.actor(id)!,'dodge',face.value,id);
        this.log(`${name}: СамоУворот ${face.value}.`,'action',{type:'shield',targetId:id});
        this.completeAction(id);return;
      }
      if(face.label.includes('Насмешка')){
        this.phase='target';
        if(!this.possibleTargets(id,this.pendingAction).length){
          this.actor(id)!.shield+=face.value;
          this.log(`${name}: Самощит ${face.value}; монстра для насмешки нет.`,'action',{type:'shield',targetId:id});
          this.completeAction(id);
        }
        return;
      }
      this.log(`Слово «${face.label}» отсутствует в согласованном словаре; эффект не применяется.`,'system');
      this.completeAction(id);return;
    }
    if(face.kind==='mana'){
      const target=this.actor(id)!;target.mana+=face.value;
      this.log(`${name} получает ${face.value} маны (сейчас ${target.mana}).`,'action',{type:'mana',targetId:id});
      this.completeAction(id);return;
    }
    if(face.kind==='empty'){
      this.log('Пустая грань: эффект отсутствует.','action');
      this.completeAction(id);return;
    }
    this.phase='target';
    if(!this.possibleTargets(id,this.pendingAction).length){
      this.log('Нет доступных целей; действие завершено без эффекта.','system');
      this.completeAction(id);
    }
  }
  cancelChoice(id:string){
    this.assertActive(id);
    if(this.phase!=='target'||!this.dice||!this.pendingAction)throw new BattleError('Отменить можно только выбор цели до применения действия.');
    this.phase='choose';this.pendingAction=null;
    this.log('Выбор грани отменён. Можно выбрать другой выпавший результат.','system');
  }

  private addStatus(target:CombatantSnapshot,kind:Parameters<typeof addEffect>[1],amount:number,source?:string){
    if(!target.alive||amount<=0)return;
    addEffect(target,kind,amount,source);
    const names:Record<string,string>={poison:'Яд',weakness:'Слабость',stun:'Оглушение',sleep:'Сон',paralysis:'Паралич',dodge:'Уворот',regeneration:'Регенерация',decay:'Гниение',petrified:'Окаменение'};
    this.log(`«${target.name}»: ${names[kind]} ${amount}.`,'action',{type:'mana',targetId:target.id});
  }
  private heal(target:CombatantSnapshot,amount:number,label:string){
    if(!target.alive)return;
    const value=Math.min(Math.max(0,amount),target.maxHp-target.hp);
    target.hp+=value;
    this.log(`${label}: лечение «${target.name}» на ${value} здоровья.`,'action',{type:'heal',targetId:target.id});
  }
  private harm(target:CombatantSnapshot,amount:number,label:string,options:{poison?:boolean,sourceId?:string,faceIndex?:number}={}){
    if(!target.alive||amount<=0)return 0;
    const def=this.foeDefinitions.get(target.id);
    // A dodge cancels one entire incoming strike, before armor or shield.
    if(!options.poison && consumeEffect(target,'dodge')){
      this.log(`«${target.name}» уклоняется от удара (${label}).`,'action',{type:'shield',targetId:target.id});
      return 0;
    }
    if(!options.poison && hasFoeTrait(def,'Бесплотность:')){
      if(this.hitUntilTurn.has(target.id)){
        this.log(`«${target.name}»: бесплотность, следующий удар не проходит.`,'system');return 0;
      }
      this.hitUntilTurn.add(target.id);
    }
    let damage=options.poison?amount:Math.max(0,amount-armorFor(def));
    if(!options.poison && hasFoeTrait(def,'Прочность:')) damage=Math.min(1,damage);
    const absorbed=options.poison?0:Math.min(target.shield,damage);
    if(!options.poison)target.shield-=absorbed;
    const applied=Math.min(target.hp,Math.max(0,damage-absorbed));
    target.hp-=applied;
    if(target.hp===0){target.alive=false;target.effects=[];}
    this.log(`${label} → «${target.name}»: ${applied} ${options.poison?'яда':'урона'}${absorbed?`, щит поглотил ${absorbed} (осталось ${target.shield})`:''}.`,'action',{type:'strike',targetId:target.id});
    // Sleep only ends after an actual point of damage, not an absorbed strike.
    if(applied>0 && target.alive)clearEffect(target,'sleep');
    if(applied>0 && target.kind==='boss' && target.name==='Лич' && !this.lichSummoned && target.hp<=target.maxHp/2){
      this.lichSummoned=true;
      for(const id of this.livingHeroes())this.summon(id,4,'Лич');
    }
    if(applied>0 && options.sourceId && this.foeDefinitions.get(target.id)?.name==='Горгона' && options.faceIndex!==undefined){
      const hero=this.actor(options.sourceId);
      if(hero?.kind==='hero'){
        let faces=this.petrifiedFaces.get(hero.id);
        if(!faces){faces=new Set();this.petrifiedFaces.set(hero.id,faces);}
        faces.add(options.faceIndex);
        this.log(`Горгона обращает в камень грань ${options.faceIndex+1} героя «${hero.name}».`,'system');
      }
    }
    if(!target.alive){
      this.petrifiedFaces.delete(target.id);this.decayedFaces.delete(target.id);
      this.log(`${target.name} погибает.`,'system');
      if(target.kind==='hero')this.transferMonsters(target.id);
      if(def?.name==='Гнилец')for(const id of this.livingHeroes()){
        const hero=this.actor(id)!;this.harm(hero,1,'Гнилец после смерти');
        if(hero.alive)this.addStatus(hero,'poison',1,target.id);
      }
    }
    return applied;
  }
  private transferMonsters(id:string){
    const idx=this.playerIds.indexOf(id);
    const next=[...this.playerIds.slice(idx+1),...this.playerIds.slice(0,idx)].find(p=>this.actor(p)?.alive);
    if(!next)return;
    for(const c of this.combatants.values())if(c.kind==='monster'&&c.alive&&c.ownerId===id){
      c.ownerId=next;
      this.log(`${c.name} переходит к следующему живому герою.`,'system');
    }
  }
  target(id:string,rawTargetId:unknown,name:string){
    this.assertActive(id);
    if(this.phase!=='target'||!this.pendingAction)throw new BattleError('Сначала выберите грань с действием.');
    if(typeof rawTargetId!=='string'||!this.possibleTargets(id,this.pendingAction).includes(rawTargetId))throw new BattleError('Недопустимая цель для выбранного действия.');
    const pending=this.pendingAction;
    const target=this.actor(rawTargetId)!;
    if(pending.kind==='strike'){
      this.harm(target,pending.value,name,{sourceId:id,faceIndex:pending.faceIndex});
    } else if(pending.kind==='heal')this.heal(target,pending.value,name);
    else if(pending.kind==='shield'){
      target.shield+=pending.value;
      this.log(`${name}: «${target.name}» получает ${pending.value} щита (всего ${target.shield}).`,'action',{type:'shield',targetId:target.id});
    } else if(pending.kind==='special'&&pending.label.includes('Насмешка')){
      const hero=this.actor(id)!;
      hero.shield+=pending.value;
      target.ownerId=id;
      this.log(`${name}: Самощит +${pending.value} (щит ${hero.shield}); «${target.name}» переманен и ответит на этом ходу. Щит поглощает урон, но не гарантирует неуязвимость.`,'action',{type:'shield',targetId:id});
    } else throw new BattleError('Этот эффект не требует цели.');
    this.completeAction(id);
  }
  private applyStartOfTurn(c:CombatantSnapshot){
    clearEffect(c,'dodge'); // previous dodge lasts only until the start of the next own turn
    const regen=statusValue(c,'regeneration');
    const poison=statusValue(c,'poison');
    if(regen>0)this.heal(c,Math.max(0,regen-poison),'Регенерация');
  }
  private applyEndOfTurn(c:CombatantSnapshot){
    if(!c.alive)return;
    const poison=statusValue(c,'poison');
    const regen=statusValue(c,'regeneration');
    const net=Math.max(0,poison-regen);
    if(net>0)this.harm(c,net,'Яд (конец хода)',{poison:true});
    clearEffect(c,'weakness');
    clearEffect(c,'paralysis');
  }
  private checkTerminal():boolean{
    const living=this.livingHeroes();
    if(!living.length){this.finish('party_wiped',[],'Все герои погибли. Партия окончена.');return true;}
    if(this.originalPlayerCount>=2 && living.length===1){this.finish('last_survivor',living,'Остался последний выживший герой. Партия окончена.');return true;}
    if(this.livingEnemies().length===0){
      if(this.floor===6)this.finish('six_floors',living,'Шестой этаж пройден! Победа отряда.');
      else{this.phase='rest';this.deadlineAt=null;this.dice=null;this.pendingAction=null;this.pendingMonsterTurn=null;this.log(`Этаж ${this.floor} пройден. Начинается привал.`,'system');}
      return true;
    }
    return false;
  }
  private finish(reason:NonNullable<BattleSnapshot['result']>['reason'],winnerIds:string[],message:string){
    this.result={reason,winnerIds};this.phase='finished';this.deadlineAt=null;this.dice=null;this.pendingAction=null;this.pendingMonsterTurn=null;
    this.log(message,'system');
  }
  private attackByEnemy(enemy:CombatantSnapshot,target:CombatantSnapshot){
    const def=this.foeDefinitions.get(enemy.id);
    if(!def||!enemy.alive||!target.alive)return;
    const words=printedFoeAction(def);
    if(!words.strike)return;
    let damage=words.amount;
    if(words.dying&&enemy.hp<enemy.maxHp/2)damage*=2;
    if(hasFoeTrait(def,'Пиявка:'))damage+=target.maxHp-target.hp;
    const victimIds=words.allHeroes?this.livingHeroes():[target.id];
    const fullTargets=new Set(victimIds);
    if(words.scatter){
      for(const id of victimIds)for(const adjacent of this.neighbors(id))fullTargets.add(adjacent);
    }
    for(const id of fullTargets){
      const victim=this.actor(id);
      if(!victim?.alive)continue;
      this.harm(victim,damage,enemy.name);
      if(!victim.alive)continue;
      if(words.poison)this.addStatus(victim,'poison',words.amount,enemy.id);
      if(words.weakness)this.addStatus(victim,'weakness',words.amount,enemy.id);
      if(words.sleep)this.addStatus(victim,'sleep',1,enemy.id);
      if(words.paralysis)this.addStatus(victim,'paralysis',words.amount,enemy.id);
      if(words.decay)this.addStatus(victim,'decay',1,enemy.id);
    }
    if(words.selfHeal)this.heal(enemy,words.amount,enemy.name);
    if(words.pain && enemy.alive)this.harm(enemy,words.amount,`${enemy.name} · Боль`);
    if(def.name==='Миазм' && enemy.alive)this.harm(enemy,enemy.hp,'Миазм · Смерть');
    if(def.name==='Чумной доктор')for(const c of this.livingEnemies())this.heal(c,words.amount,def.name);
  }
  private monsterPhase(playerId:string){
    const target=this.actor(playerId);
    if(!target?.alive)return;
    // Captured monsters act this turn too; summons added during the turn act next time.
    const monsters=this.ownMonsters(playerId);
    for(const monster of monsters){
      if(!target.alive)break;
      this.hitUntilTurn.delete(monster.id);
      this.applyStartOfTurn(monster);
      if(consumeEffect(monster,'stun')){
        this.log(`«${monster.name}» оглушён и пропускает ход.`,'turn');continue;
      }
      this.log(`Ход монстра «${monster.name}».`,'turn',{type:'turn',targetId:monster.id});
      const def=this.foeDefinitions.get(monster.id);
      if(def?.name==='Надгробие')this.summon(playerId,1,monster.name);
      else this.attackByEnemy(monster,target);
      if(monster.alive && def?.name==='Тень')this.addStatus(monster,'dodge',1,monster.id);
      if(monster.alive && hasFoeTrait(def,'Перемещение:')){
        const next=this.playerIds.slice(this.playerIds.indexOf(playerId)+1).concat(this.playerIds.slice(0,this.playerIds.indexOf(playerId))).find(id=>this.actor(id)?.alive);
        if(next){monster.ownerId=next;this.log(`${monster.name} перемещается к следующему герою.`,'system');}
      }
      if(monster.alive)this.applyEndOfTurn(monster);
    }
  }
  private bossPhase(){
    const boss=this.actor('boss');const def=this.foeDefinitions.get('boss');
    if(!boss?.alive||!def)return;
    this.hitUntilTurn.delete(boss.id);
    this.applyStartOfTurn(boss);
    if(consumeEffect(boss,'stun')){this.log(`Босс «${boss.name}» оглушён и пропускает ход.`,'turn');return;}
    const candidates=this.livingHeroes();if(!candidates.length)return;
    this.log(`Ход босса «${boss.name}».`,'turn',{type:'turn',targetId:'boss'});
    const weakest=def.description.includes('наименьшим');
    const strongest=def.description.includes('наибольшим');
    const chosen=weakest?[...candidates].sort((a,b)=>this.actor(a)!.hp-this.actor(b)!.hp)[0]!
      :strongest?[...candidates].sort((a,b)=>this.actor(b)!.hp-this.actor(a)!.hp)[0]!
      :candidates[this.pickIndex(candidates.length)]!;
    this.attackByEnemy(boss,this.actor(chosen)!);
    if(boss.alive && boss.name==='Прокаженный'){
      for(const id of this.livingHeroes()){
        const hero=this.actor(id)!;hero.maxHp=Math.max(1,hero.maxHp-1);
        hero.hp=Math.min(hero.hp,hero.maxHp);
        this.log(`Чума: «${hero.name}» теряет 1 к максимальному здоровью.`,'action',{type:'strike',targetId:id});
      }
    }
    if(boss.alive)this.applyEndOfTurn(boss);
  }
  private completeAction(id:string,resetMisses=true){
    if(resetMisses)this.consecutiveMisses.set(id,0);
    const source=this.actor(id);
    if(source && this.pendingAction?.faceIndex !== undefined && statusValue(source,'decay')>0){
      const used=this.decayedFaces.get(id)??new Map<number,number>();
      const idx=this.pendingAction.faceIndex;used.set(idx,(used.get(idx)??0)+1);
      this.decayedFaces.set(id,used);
      this.log(`${source.name}: Гниение ослабляет использованную грань ${idx+1}.`,'system');
    }
    if(source && source.alive){
      const paralysis=statusValue(source,'paralysis');
      if(paralysis>0){this.harm(source,paralysis,'Паралич · Боль');}
      if(source.alive)this.applyEndOfTurn(source);
    }
    if(source && source.mana>source.maxMana){
      const overflow=source.mana-source.maxMana;source.mana=source.maxMana;
      this.log(`Избыточная мана (${overflow}) сброшена в конце хода.`,'system');
    }
    this.pendingAction=null;
    if(this.checkTerminal())return;
    this.phase='enemy';this.pendingMonsterTurn=id;this.deadlineAt=this.now()+this.enemyPauseMs;
  }
  pass(id:string,name:string){
    this.assertActive(id);this.log(`${name} завершает ход без действия.`,'system');this.completeAction(id);
  }
  continueFloor(){
    if(this.phase!=='rest')throw new BattleError('Следующий этаж пока недоступен.');
    if(this.floor>=6)throw new BattleError('Шестой этаж уже пройден.');
    this.floor++;
    for(const id of this.playerIds){
      const hero=this.actor(id);if(!hero)continue;
      const rolled=this.die();if(!Number.isInteger(rolled)||rolled<1||rolled>6)throw new BattleError('Ошибка броска на привале.');
      const wasDead=!hero.alive;hero.alive=true;hero.hp=Math.min(hero.maxHp,hero.hp+2+rolled);
      // Death removes temporary ailments; persistent poison survives a successful battle.
      if(wasDead){hero.effects=[];this.petrifiedFaces.delete(id);this.decayedFaces.delete(id);}
      this.log(`${hero.name}: ${wasDead?'возвращается в отряд, ':''}восстанавливает здоровье (2 + ${rolled}) → ${hero.hp}/${hero.maxHp}.`,'system');
    }
    this.setupEnemies();this.pendingMonsterTurn=null;this.dice=null;this.pendingAction=null;
    this.round=1;this.activeIndex=(this.activeIndex+1)%this.playerIds.length;this.consecutiveMisses.clear();
    this.log('Получение артефактов будет подключено в 3.4.','system');
    this.prepareTurn(true);
  }
  tick(isConnected:(id:string)=>boolean,nameOf:(id:string)=>string):string[]{
    if(this.phase==='enemy'){
      if(this.deadlineAt===null||this.now()<this.deadlineAt)return [];
      const defender=this.pendingMonsterTurn;this.pendingMonsterTurn=null;
      if(defender)this.monsterPhase(defender);
      if(!this.checkTerminal())this.advanceTurn();
      return [];
    }
    if(!['roll','choose','target'].includes(this.phase)||this.deadlineAt===null||this.now()<this.deadlineAt)return [];
    const active=this.activePlayer();if(!active)return [];
    const online=isConnected(active);
    const misses=online?(this.consecutiveMisses.get(active)??0)+1:(this.consecutiveMisses.get(active)??0);
    if(online)this.consecutiveMisses.set(active,misses);
    this.pendingAction=null;this.log(`${nameOf(active)}: время вышло, ход пропущен.`,'timeout');
    this.completeAction(active,false);
    return online&&misses>=2?[active]:[];
  }
  disconnected(id:string){
    this.absent.add(id);
    if(this.activePlayer()===id&&this.deadlineAt!==null)this.deadlineAt=Math.min(this.deadlineAt,this.now()+this.durations.shortMs);
  }
  reconnected(id:string){this.absent.delete(id);}
  remove(id:string,label:string){
    const idx=this.playerIds.indexOf(id);if(idx===-1)return;
    const wasActive=idx===this.activeIndex;
    this.combatants.delete(id);this.petrifiedFaces.delete(id);this.decayedFaces.delete(id);
    for(const c of [...this.combatants.values()])if(c.kind==='monster'&&c.id===`monster:${this.floor}:${id}`){
      this.combatants.delete(c.id);this.foeDefinitions.delete(c.id);
    }
    for(const c of this.combatants.values())if(c.kind==='monster'&&c.ownerId===id)c.ownerId=this.playerIds.find(x=>x!==id&&this.actor(x)?.alive)??null;
    this.playerIds.splice(idx,1);this.heroes.delete(id);this.absent.delete(id);this.consecutiveMisses.delete(id);
    this.log(`${label} покидает отряд.`,'system');
    if(!this.playerIds.length){this.activeIndex=0;this.phase='paused';this.deadlineAt=null;this.dice=null;this.pendingAction=null;return;}
    if(idx<this.activeIndex)this.activeIndex--;
    if(this.activeIndex>=this.playerIds.length)this.activeIndex=0;
    if(this.phase==='finished'||this.phase==='rest')return;
    if(this.phase==='enemy'){
      if(wasActive){
        this.pendingMonsterTurn=null;
        if(this.checkTerminal())return;
        if(idx>=this.playerIds.length){this.bossPhase();if(this.checkTerminal())return;this.round++;}
        this.prepareTurn(true);
      }
      return;
    }
    if(this.checkTerminal())return;
    if(wasActive)this.prepareTurn(true);
  }
  private advanceTurn(){
    if(!this.playerIds.length)return;
    let next=(this.activeIndex+1)%this.playerIds.length;
    if(next===0){this.bossPhase();if(this.checkTerminal())return;this.round++;}
    let safe=0;
    while(!this.actor(this.playerIds[next]!)?.alive&&safe++<this.playerIds.length){
      next=(next+1)%this.playerIds.length;
      if(next===0){this.bossPhase();if(this.checkTerminal())return;this.round++;}
    }
    this.activeIndex=next;this.prepareTurn();
  }
  private prepareTurn(first=false){
    this.phase='roll';this.dice=null;this.pendingAction=null;
    const active=this.activePlayer();
    if(!active||!this.actor(active)?.alive){this.phase='paused';this.deadlineAt=null;return;}
    const hero=this.actor(active)!;
    this.applyStartOfTurn(hero);
    if(consumeEffect(hero,'stun')||statusValue(hero,'sleep')>0){
      this.log(`${hero.name} пропускает ход из-за оглушения или сна.`,'timeout',{type:'turn',targetId:active});
      // A skipped turn is still a turn: end-of-turn poison and weakness apply.
      this.applyEndOfTurn(hero);
      if(this.checkTerminal())return;
      this.phase='enemy';this.pendingMonsterTurn=active;this.deadlineAt=this.now()+this.enemyPauseMs;
      return;
    }
    const missed=this.consecutiveMisses.get(active)??0;
    const ms=missed>0||this.absent.has(active)?this.durations.shortMs:this.durations.normalMs;
    this.deadlineAt=this.now()+ms;
    this.log(first?'Первый ход этажа: бросьте два кубика.':`Следующий ход (${ms/1000} сек.).`,'turn',{type:'turn',targetId:active});
  }
}
