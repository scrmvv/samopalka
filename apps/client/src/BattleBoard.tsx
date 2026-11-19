
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, Clock3, Dice5, Heart, MessageSquare, ScrollText, Wrench, X, Info } from 'lucide-react';
import { HEROES, HERO_DICE, type DiceFace, type RoomSnapshot, type CombatantSnapshot, type StatusEffect } from '@samopalka/shared';
import { HeroSprite } from './HeroSprite';
import { DebugPanel } from './DebugPanel';
import { radialPosition, PLAYER_RING_RADIUS, visibleMonsters, monsterGridPositions } from './boardLayout';

type Props = {
  room: RoomSnapshot;
  playerId: string;
  online: boolean;
  busy: boolean;
  error: string;
  onAction: (event: string, payload: unknown) => void;
  onExit: () => void;
  onClearError: () => void;
};

const ENEMY_PATTERNS: Record<string, string[]> = {
  skeleton: ['....xxxx....','...xxxxxx...','..xxwwwwxx..','..xw0ww0wx..','..xxwwwwxx..','...xxxxxx...','....xxxx....','..xxxxxxxx..','..xx.xx.xx..','..xx.xx.xx..','..xx....xx..','............'],
  rogue: ['....pppp....','...pppppp...','..pppppppp..','..p0pppp0p..','..pppppppp..','...pppppp...','...pwwwwp...','..pppppppp..','..pppppppp..','...p....p...','..pp......pp','............'],
  archer: ['.....ww.....','....wwww....','...w0ww0w...','....wwww....','....xxxx....','...xxxwxx...','..wxxxxxxw..','...xx..xx...','...xx..xx...','..xxx..xxx..','............','............'],
  brute: ['...rrrrrr...','..rrrrrrrr..','..rr0rr0rr..','...rrrrrr...','..rrrxxrrr..','..rrxxxxrr..','.rrrxxxxrrr.','.rrrxxxxrrr.','...rr..rr...','...rr..rr...','..rr....rr..','............'],
  boss: ['....rrrr....','...rxxxxr...','..rx0xx0xr..','..rxxxxxxr..','...rrrrrr...','..rrxxxxrr..','.rrrxxxxrrr.','.rrrxxxxrrr.','..rxxxxxxr..','..rr.rr.rr..','..rr.rr.rr..','............']
};
const MONSTER_VARIANTS = ['skeleton','rogue','archer','brute'] as const;
function EnemySprite({ variant }: { variant: string }) {
  const palette: Record<string,string> = { x:'#74838a',w:'#ccd4c7','0':'#d66359',p:'#6c657e',r:'#a55c50' };
  return <svg className="battle-pixel" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
    {(ENEMY_PATTERNS[variant] ?? ENEMY_PATTERNS.skeleton).flatMap((line,y)=>[...line].map((ch,x)=>ch==='.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[ch] || '#9fb2ae'}/>))}
  </svg>;
}
function EffectMark({face}:{face:DiceFace}) {
  return <span className={'battle-effect-symbol type-'+face.kind} aria-hidden="true">
    {face.kind==='strike' ? '⚔' : face.kind==='shield' ? '◆' : face.kind==='heal' ? '+' : face.kind==='mana' ? '✧' : face.kind==='special' ? '✦' : '−'}
  </span>;
}
function CombatStats({ entity }:{ entity:CombatantSnapshot | undefined }) {
  if (!entity) return null;
  return <span className="combat-token-stats">
    <span className="combat-hp"><Heart size={10} fill="currentColor"/> {entity.hp}/{entity.maxHp}</span>
    {entity.shield>0 && <span className="combat-shield">◆ {entity.shield}</span>}
    {entity.kind==='hero' && <span className="combat-mana">✧ {entity.mana}/{entity.maxMana}</span>}
  </span>;
}
const EFFECT_INFO: Record<StatusEffect['kind'],{symbol:string;label:string}> = {
  poison:{symbol:'☠',label:'Яд'}, weakness:{symbol:'↓',label:'Слабость'},
  stun:{symbol:'✦',label:'Оглушение'}, sleep:{symbol:'☾',label:'Сон'},
  paralysis:{symbol:'⚡',label:'Паралич'}, dodge:{symbol:'↝',label:'Уворот'},
  regeneration:{symbol:'✚',label:'Регенерация'}, decay:{symbol:'−',label:'Гниение'},
  petrified:{symbol:'◇',label:'Окаменение'}
};
function StatusBadges({entity}:{entity:CombatantSnapshot|undefined}){
  const effects=(entity?.effects??[]).filter(e=>e.amount>0);
  if(!effects.length)return null;
  return <span className="combat-effect-pills" aria-label="Активные эффекты">
    {effects.slice(0,3).map((effect,i)=>
      <span key={`${effect.kind}-${i}`} className={'combat-effect-pill status-'+effect.kind}
        title={`${EFFECT_INFO[effect.kind].label}: ${effect.amount}`}>
        {EFFECT_INFO[effect.kind].symbol}{effect.amount}
      </span>)}
    {effects.length>3 && <span className="combat-effect-pill" title={effects.slice(3).map(e=>EFFECT_INFO[e.kind].label).join(', ')}>+{effects.length-3}</span>}
  </span>;
}
function DieCell({face, number, action}:{face:DiceFace;number:number;action?:()=>void}) {
  const classes = 'battle-die type-'+face.kind+(action?' interactive':'');
  const contents = <><span className="battle-die-no">{number}</span><EffectMark face={face}/><strong>{face.label}</strong></>;
  return action ? <button className={classes} type="button" title={face.note ?? face.label} onClick={action}>{contents}</button> : <div className={classes} title={face.note ?? face.label}>{contents}</div>;
}
export function BattleBoard({room,playerId,online,busy,error,onAction,onExit,onClearError}:Props) {
  const game = room.game!;
  const [tick,setTick] = useState(Date.now());
  const [leaveConfirm,setLeaveConfirm] = useState(false);
  const [chatOpen,setChatOpen] = useState(false);
  const [debugOpen,setDebugOpen] = useState(false);
  const [inspectedFoe,setInspectedFoe] = useState<string|null>(null);
  const [rewardFaceIndex,setRewardFaceIndex] = useState<number|null>(null);
  const [selectedReward,setSelectedReward] = useState<string|null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize,setBoardSize] = useState({width:1050,height:700});
  useEffect(()=>{
    const board=boardRef.current;
    if(!board)return;
    const observer=new ResizeObserver(entries=>{
      const rect=entries[0]?.contentRect;
      if(rect && rect.width>0 && rect.height>0) {
        setBoardSize(old=>old.width===rect.width&&old.height===rect.height ? old : {width:rect.width,height:rect.height});
      }
    });
    observer.observe(board);
    return ()=>observer.disconnect();
  },[]);
  useEffect(() => {
    if (!leaveConfirm && !debugOpen && !inspectedFoe) return;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return () => {document.body.style.overflow=oldOverflow;};
  }, [leaveConfirm,debugOpen,inspectedFoe]);
  useEffect(() => {
    if (!leaveConfirm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLeaveConfirm(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [leaveConfirm]);
  const [flashes,setFlashes] = useState<{key:number;targetId:string;type:string}[]>([]);
  const lastSeenEvent = useRef<number>(game.events.at(-1)?.id ?? 0);
  const flashTimers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const lastLogId = game.events.at(-1)?.id ?? 0;
  useEffect(() => {
    const newEvents = game.events.filter(e => e.id > lastSeenEvent.current);
    lastSeenEvent.current = lastLogId;
    const effects = newEvents.flatMap(e => e.visual?.targetId ? [{key:e.id,targetId:e.visual.targetId,type:e.visual.type}] : []);
    if (effects.length) {
      setFlashes(old => [...old,...effects].slice(-12));
      const timer = window.setTimeout(() => setFlashes(old => old.filter(item => !effects.some(e => e.key===item.key))), 1050);
      flashTimers.current.push(timer);
    }
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [lastLogId, game.events]);
  useEffect(() => () => flashTimers.current.forEach(timer => window.clearTimeout(timer)), []);
  const visualFor = (id:string) => flashes.filter(e=>e.targetId===id);

  useEffect(()=> { const interval = window.setInterval(()=>setTick(Date.now()),200); return ()=>window.clearInterval(interval); },[]);
  const [serverOffset,setServerOffset] = useState(()=>game.serverTime-Date.now());
  useEffect(()=>{setServerOffset(game.serverTime-Date.now());},[game.serverTime]);
  const left = game.deadlineAt === null ? 0 : Math.max(0,Math.ceil((game.deadlineAt-tick-serverOffset)/1000));
  const mine = room.players.find(p=>p.id===playerId);
  const mineHero = HEROES.find(h=>h.id===mine?.heroId);
  const active = room.players.find(p=>p.id===game.activePlayerId);
  const myTurn = Boolean(mine && game.activePlayerId===mine.id && online);
  const canAct = myTurn && !busy && left>0 && ['roll','choose','target'].includes(game.phase);
  const faces = mine?.heroId ? (game.diceFaces?.[playerId] ?? HERO_DICE[mine.heroId]) : [];
  const myArtifacts = game.inventories?.[playerId] ?? [];
  const reward = game.rewardDraft;
  const rewardActor = room.players.find(p=>p.id===reward?.playerId);
  useEffect(()=>{setSelectedReward(null);setRewardFaceIndex(null);},[reward?.playerId,game.floor]);
  const camp = game.campRest;
  const waitingForCampRoll = Boolean(camp?.pendingPlayerIds.includes(playerId));
  const mayChooseReward = game.phase==='rest' && reward?.playerId===playerId && online && !busy;
  const activeFaces = active?.heroId ? (game.diceFaces?.[active.id] ?? HERO_DICE[active.heroId]) : [];
  const title = game.phase==='enemy' ? 'ХОД МОНСТРОВ' : game.phase==='paused' ? 'ИГРА ПРИОСТАНОВЛЕНА' : game.phase==='rest' ? (camp?.completed ? 'ПРИВАЛ · НАГРАДЫ' : 'ПРИВАЛ · БРОСОК') : game.phase==='finished' ? 'ПАРТИЯ ОКОНЧЕНА' : myTurn ? 'ВАШ ХОД' : `ХОДИТ: ${active?.nickname ?? 'ИГРОК'}`;
  const awaiting = !online ? 'Соединение прервано. Возвращаемся в игру…' : game.phase==='paused' ? 'В комнате не осталось участников.' : game.phase==='enemy' ? 'Монстры готовятся ответить…' : game.phase==='rest' ? (camp?.completed ? 'Привал: герои выбирают артефакты и улучшения кубиков.' : 'Привал: каждый игрок бросает кубик для восстановления HP.') : game.phase==='finished' ? 'Результат партии отображается на поле.' : myTurn ? game.phase==='roll' ? 'Бросьте два кубика.' : game.phase==='choose' ? 'Выберите одну из двух граней.' : 'Выберите подсвеченную цель на поле.' : 'Ожидайте действия другого игрока.';
  const rolls = useMemo(()=>game.rolls?.map((n,i)=>({n,index:i,face: activeFaces[n-1]})) ?? [],[game.rolls,activeFaces]);
  // Dead monsters remain in the server's history but must not occupy table space.
  // Keep the original sprite index so survivors do not change appearance after kills.
  const allMonsters = game.combatants.filter(c => c.kind === 'monster');
  const monsters = visibleMonsters(allMonsters).map(c => ({
    id:c.id, ownerId:c.ownerId, ownerNickname:room.players.find(p=>p.id===c.ownerId)?.nickname ?? 'герой',
    variant: MONSTER_VARIANTS[allMonsters.indexOf(c) % MONSTER_VARIANTS.length], name:c.name
  }));
  const monsterPositions = monsterGridPositions(monsters, room.players.map(p => p.id), boardSize);
  const combatants = useMemo(() => new Map(game.combatants.map(c => [c.id, c])), [game.combatants]);
  const canTarget = (id: string) => canAct && game.phase==='target' && game.availableTargetIds.includes(id);
  const pickTarget = (id: string) => { if (canTarget(id)) onAction('game:target', id); };

  return <main className="battle-shell battle-circular-shell">
    <div className="battle-topline">
      <div>
        <div className="overline">ПОДЗЕМЕЛЬЕ · {room.name}</div>
        <h1>ПУТЬ ПРОКЛЯТЫХ</h1>
        <p>ЭТАЖ {game.floor} <span>·</span> {title}</p>
      </div>
      <div className="battle-toolbar">
        {room.debug && mine?.isHost && <button type="button" className="battle-debug-trigger" onClick={()=>setDebugOpen(true)} title="Тестовая панель"><Wrench size={15}/> ТЕСТ</button>}
        <button type="button" className="battle-icon-button" onClick={()=>setChatOpen(v=>!v)} aria-pressed={chatOpen} title="Чат"><MessageSquare size={16}/></button>
        <div className={'battle-timer panel '+(left<=5&&game.deadlineAt!==null?'urgent':'')}><Clock3 size={18}/><div className="battle-timer-value"><strong>{game.deadlineAt===null?'—':left}</strong><span>{game.phase==='rest'?'НАГРАДА · СЕК':'СЕК'}</span></div></div>
      </div>
    </div>

    <div className="battle-layout-circular">
      <section className="battle-stage-circle panel" aria-label="Поле боя">
        <span className="battle-hidden-status" aria-live="polite">{awaiting}</span>
        <div className={`table-board players-${room.players.length}`} ref={boardRef}>

          {room.players.map((p, index)=>{
            const hero = p.heroId ? HEROES.find(h=>h.id===p.heroId) : null;
            return <div key={p.id} className={'table-seat lane-'+(index%6)+' '+(p.id===playerId?'self ':'')+(p.id===game.activePlayerId?'active ':'')+(!p.connected?'offline':'')} style={radialPosition(index, room.players.length, PLAYER_RING_RADIUS)}>
              <button type="button" disabled={!canTarget(p.id)} onClick={()=>pickTarget(p.id)}
                className={'table-seat-card token-interaction '+(canTarget(p.id)?'can-target ':'')+(!combatants.get(p.id)?.alive?'defeated':'')} title={canTarget(p.id)?'Выбрать цель':''}>
                <div className="table-seat-sprite">{p.heroId ? <HeroSprite id={p.heroId} compact/> : <div className="empty-seat">+</div>}</div>
                <strong>{p.nickname}{p.id===playerId?' · ВЫ':''}</strong>
                <small>{hero?.name ?? 'Герой не выбран'}</small>
                <CombatStats entity={combatants.get(p.id)}/><StatusBadges entity={combatants.get(p.id)}/>{visualFor(p.id).map(e=><span key={e.key} className={'battle-token-flash flash-'+e.type} aria-hidden="true"/>)}
              </button>
            </div>;
          })}

          {monsters.map((monster, index)=>{
            // Taunted or summoned monsters may share an owner; each gets its own
            // click-safe position rather than overlapping their sprites.
            const crowded = monsters.length > room.players.length || monsters.some((other,i)=>i!==index && other.ownerId===monster.ownerId);
            const ownerActive = monster.ownerId === game.activePlayerId;
            return <div key={monster.id} title={`${monster.name} — напротив ${monster.ownerNickname}`} className={'table-monster lane-'+(index%6)+' '+(ownerActive?'active':'')+(crowded?' crowded':'')} style={monsterPositions[index]}>
              <button type="button" onClick={()=>canTarget(monster.id)?pickTarget(monster.id):setInspectedFoe(monster.id)} title={canTarget(monster.id)?'Выбрать цель':'Открыть описание монстра'} className={'table-monster-card token-interaction '+(canTarget(monster.id)?'can-target ':'')}>
                <EnemySprite variant={monster.variant}/>
                <strong>{monster.name}</strong>
                <CombatStats entity={combatants.get(monster.id)}/>{game.foeInfo?.[monster.id]?.currentAction && <span className="battle-monster-face" title={game.foeInfo[monster.id]!.currentAction}>Сила {game.foeInfo[monster.id]!.currentAction!.split(',').at(-1)?.trim()}</span>}<StatusBadges entity={combatants.get(monster.id)}/>{visualFor(monster.id).map(e=><span key={e.key} className={'battle-token-flash flash-'+e.type} aria-hidden="true"/>)}
              </button>
              <button type="button" className="battle-foe-info" onClick={()=>setInspectedFoe(monster.id)} title={`Прочитать способности: ${monster.name}`} aria-label={`Способности монстра ${monster.name}`}><Info size={13}/></button>
            </div>;
          })}

          {combatants.get('boss')?.alive && <div className="table-boss-core">
            <button type="button" onClick={()=>canTarget('boss')?pickTarget('boss'):setInspectedFoe('boss')} title={canTarget('boss')?'Выбрать босса':'Открыть описание босса'} className={'boss-card token-interaction '+(canTarget('boss')?'can-target ':'')}>
              <EnemySprite variant="boss"/>
              <strong>{combatants.get('boss')?.name ?? 'БОСС'}</strong>
              <CombatStats entity={combatants.get('boss')}/><StatusBadges entity={combatants.get('boss')}/>{visualFor('boss').map(e=><span key={e.key} className={'battle-token-flash flash-'+e.type} aria-hidden="true"/>)}
              <small>Общая цель для всех игроков</small>
            </button>
            <button type="button" className="battle-foe-info boss-info" onClick={()=>setInspectedFoe('boss')} title="Прочитать способности босса" aria-label="Способности босса"><Info size={14}/></button>
          </div>}
        </div>
        {(game.phase==='rest' || game.phase==='finished') && <div className="battle-milestone panel" role="status">
          <h2>{game.phase==='rest' ? `Этаж ${game.floor} пройден!` : game.result?.reason==='six_floors' ? 'Все 6 этажей пройдены!' : game.result?.reason==='last_survivor' ? 'Последний выживший!' : 'Партия окончена'}</h2>
          <p>{game.phase==='rest' ? (camp?.completed?'Все броски на привале сделаны. Выберите награду; на каждого игрока даётся 60 секунд.':'Каждый игрок сам бросает d6. Восстановление: 2 + результат кубика (не выше максимума HP).') : game.result?.reason==='party_wiped' ? 'Никому не удалось выжить.' : game.result?.winnerIds.includes(playerId) ? 'Вы среди победителей.' : 'Результат зафиксирован на сервере.'}</p>
          {game.phase==='rest' && camp && !camp.completed && <div className="battle-reward-panel battle-camp-panel">
            <div className="battle-reward-current">Бросили кубик: {camp.results.length} из {room.players.length}</div>
            <div className="battle-camp-results">
              {room.players.map(p=>{
                const result=camp.results.find(r=>r.playerId===p.id);
                return <div key={p.id} className="battle-camp-result">
                  <strong>{p.nickname}</strong>
                  <span>{result?`🎲 ${result.die} · +${result.healed} HP · ${result.hp}/${result.maxHp}`:'Ожидает броска'}</span>
                </div>;
              })}
            </div>
            {waitingForCampRoll
              ? <button type="button" className="button button-primary" disabled={!online||busy} onClick={()=>onAction('game:roll-camp',{})}>🎲 Бросить d6 и восстановить здоровье</button>
              : <small>Ваш бросок принят. Ожидаем остальных участников.</small>}
          </div>}
          {game.phase==='rest' && reward && <div className="battle-reward-panel">
            <div className="battle-reward-current" role="status">{reward.completed?'Все награды выбраны.':`Сейчас выбирает: ${rewardActor?.nickname ?? 'участник'} · ${left} сек.`}</div>
            {!reward.completed && !selectedReward && <>
              <p className="battle-reward-explainer">Сначала выберите награду. Если она изменяет кубик, следующим шагом выберете конкретную грань.</p>
              <div className="battle-reward-options">
                {reward.offers.map(card=><div className="battle-reward-card" key={card.id}>
                  <span className="battle-reward-tier">Тир {card.tier} · {card.group}</span>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                  <button type="button" className="button button-primary" disabled={!mayChooseReward||left===0} onClick={()=>{
                    if(card.kind==='face'||card.kind==='doubleface'){setSelectedReward(card.id);setRewardFaceIndex(null);}
                    else onAction('game:claim-reward',{choice:card.id});
                  }}>{card.kind==='face'||card.kind==='doubleface'?'Выбрать → грань':'Получить артефакт'}</button>
                </div>)}
              </div>
              <div className="battle-reward-alternatives">
                <button type="button" className="button button-secondary" disabled={!mayChooseReward||left===0} onClick={()=>onAction('game:claim-reward',{choice:'maxhp'})}>Вместо артефакта: +2 макс. HP</button>
                <button type="button" className="button button-secondary" disabled={!mayChooseReward||left===0} onClick={()=>{setSelectedReward('faceup');setRewardFaceIndex(null);}}>Вместо артефакта: +1 к грани →</button>
              </div>
            </>}
            {!reward.completed && selectedReward && <div className="battle-reward-second-step">
              <h3>Шаг 2 · Выберите грань кубика</h3>
              <p>{selectedReward==='faceup'?'Усиление выбранной грани на +1':reward.offers.find(card=>card.id===selectedReward)?.title??'Артефакт'}</p>
              <div className="battle-reward-face-grid">
                {faces.map((face,index)=><button key={index} type="button" className={'battle-reward-face-tile '+(rewardFaceIndex===index?'selected':'')} disabled={!mayChooseReward||left===0} onClick={()=>setRewardFaceIndex(index)}>
                  <span>СТОРОНА {index+1}</span><strong>{face.label}</strong>
                </button>)}
              </div>
              <div className="battle-reward-second-actions">
                <button type="button" className="button button-secondary" disabled={!mayChooseReward} onClick={()=>{setSelectedReward(null);setRewardFaceIndex(null);}}>← Назад к наградам</button>
                <button type="button" className="button button-primary" disabled={!mayChooseReward||rewardFaceIndex===null||left===0} onClick={()=>onAction('game:claim-reward',{choice:selectedReward,faceIndex:rewardFaceIndex})}>Подтвердить замену грани</button>
              </div>
            </div>}
            {reward.completed && mine?.isHost && <button className="button button-primary" disabled={busy || !online} onClick={()=>onAction('game:next-floor',{})}>Перейти на этаж {game.floor+1}</button>}
            {reward.completed && !mine?.isHost && <small>Ожидаем перехода от хоста.</small>}
            <small>Выбрали награду: {reward.chosenIds.length} из {room.players.length}</small>
          </div>}
          {game.phase==='finished' && mine?.isHost && <button className="button button-primary battle-replay" disabled={busy || !online} onClick={()=>onAction('room:replay', {})}>Вернуть отряд в лобби</button>}
          {game.phase==='finished' && !mine?.isHost && <small>Ожидаем хоста — он может вернуть всех в лобби без нового кода комнаты.</small>}
        </div>}
      </section>

      <aside className="battle-side-column">
        <section className="battle-panel-combined panel">
          <div className="battle-section-heading compact">
            <h2><Dice5 size={16}/> КУБИК И АРТЕФАКТЫ</h2>
            <span>{mineHero?.name ?? 'Герой'}</span>
          </div>
          {game.phase === 'target' && <div className="battle-target-hint" role="status">
              <span>{myTurn ? `Выберите цель: ${game.pendingAction?.label ?? 'действие'}` : `${active?.nickname ?? 'Игрок'} выбирает цель`}</span>
              {myTurn && <button type="button" className="battle-undo-choice" disabled={!canAct} onClick={()=>onAction('game:cancel-choice',{})}>↶ Другая грань</button>}
            </div>}
          <div className="battle-six compact">{faces.map((face,index)=><DieCell key={index} face={face} number={index+1}/>)}</div>
          {game.phase==='choose' && game.rolls ? <>
            <div className="battle-choice-label">{myTurn ? 'ВЫПАЛИ ДВА РЕЗУЛЬТАТА — ВЫБЕРИТЕ ОДИН' : `РЕЗУЛЬТАТЫ БРОСКА: ${active?.nickname ?? 'ИГРОК'}`}</div>
            <div className="battle-roll-results compact">{rolls.map(result=><DieCell key={result.index} face={result.face} number={result.n} action={canAct?()=>onAction('game:choose',result.index):undefined} />)}</div>
          </> : <div className="battle-roll-note">{game.phase==='target' ? 'Подсвеченные фигурки доступны для выбора цели.' : 'Бросьте два кубика и выберите один результат.'}</div>}
          <div className="battle-artifact-stack">
            <div className="artifact-placeholder"><span>✦</span><div><strong>Артефакты</strong><small>{myArtifacts.length ? `Получено: ${myArtifacts.length}` : "Пока не получены"}</small></div></div>
            <div className="artifact-placeholder"><span>◆</span><div><strong>Ресурсы</strong><small>Мана {combatants.get(playerId)?.mana ?? 0}/{combatants.get(playerId)?.maxMana ?? 3} · Щит {combatants.get(playerId)?.shield ?? 0}</small><small className="battle-status-summary">{(combatants.get(playerId)?.effects??[]).map(e=>`${EFFECT_INFO[e.kind].label} ${e.amount}`).join(" · ") || "Нет негативных эффектов"}</small></div></div>
          </div>
          {myArtifacts.length>0 && <div className="battle-inventory" aria-label="Полученные артефакты">
            {myArtifacts.map(item=><div className="battle-inventory-item" key={item.instanceId} title={item.description}>
              <span className="battle-artifact-name">✦ {item.title}{item.faceIndex!==undefined?` · грань ${item.faceIndex+1}`:''}{item.spent?' · использован':''}</span>
              {item.kind==='consumable' && !item.spent && <button type="button" disabled={!canAct} onClick={()=>onAction('game:use-artifact',item.instanceId)}>Применить</button>}
            </div>)}
          </div>}
          <div className="battle-action-buttons single-row">
            <button className="button button-primary" disabled={!canAct || game.phase!=='roll'} onClick={()=>onAction('game:roll',{})}><Dice5 size={18}/> Бросить кубики</button>
          </div>
          <button className="battle-pass-link" disabled={!canAct} onClick={()=>onAction('game:pass',{})}>Пропустить ход</button>
        </section>

        <section className="battle-log panel compact-log">
          <div className="battle-section-heading compact"><h2><ScrollText size={16}/> ЖУРНАЛ</h2><span>Ход партии</span></div>
          <div className="battle-events compact" ref={logRef} aria-label="Журнал боя: новые события сверху">{[...game.events].reverse().map(e=><p key={e.id} className={'battle-event event-'+e.kind}>{e.text}</p>)}</div>
        </section>

        <section className="battle-controls panel mini-controls"><button className="battle-leave" onClick={()=>setLeaveConfirm(true)}><ArrowLeft size={15}/> Покинуть игру</button></section>
      </aside>
    </div>

    {inspectedFoe && combatants.get(inspectedFoe) && createPortal(
      <div className="battle-foe-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setInspectedFoe(null);}}>
        <section className="panel battle-foe-card" role="dialog" aria-modal="true" aria-label={`Способности: ${combatants.get(inspectedFoe)?.name}`}>
          <div className="battle-foe-card-head"><span>БЕСТИАРИЙ · ЭТАЖ {game.foeInfo?.[inspectedFoe]?.floor ?? game.floor}</span><button type="button" onClick={()=>setInspectedFoe(null)} title="Закрыть"><X size={17}/></button></div>
          <h2>{combatants.get(inspectedFoe)?.name}</h2>
          <p className="battle-foe-parameters">Здоровье: {combatants.get(inspectedFoe)?.hp}/{combatants.get(inspectedFoe)?.maxHp} · Щит: {combatants.get(inspectedFoe)?.shield}</p>
          {game.foeInfo?.[inspectedFoe]?.currentAction && <p className="battle-foe-parameters">Текущая грань: {game.foeInfo[inspectedFoe]!.currentAction}</p>}
          <h3>СЛОВА И ОСОБЕННОСТИ</h3>
          <p className="battle-foe-description">{game.foeInfo?.[inspectedFoe]?.description ?? 'Описание отсутствует в каталоге.'}</p>
          <button type="button" className="button button-primary" onClick={()=>setInspectedFoe(null)}>Вернуться к бою</button>
        </section>
      </div>,document.body
    )}

    {debugOpen && room.debug && mine?.isHost && createPortal(<DebugPanel room={room} playerId={playerId} busy={busy||!online} onAction={onAction} onClose={()=>setDebugOpen(false)}/>, document.body)}

    {chatOpen && <div className="battle-chat-drawer panel" role="dialog" aria-label="Чат"><div className="battle-section-heading compact"><h2><MessageSquare size={16}/> ЧАТ</h2><button className="battle-icon-button" type="button" onClick={()=>setChatOpen(false)} title="Закрыть"><X size={14}/></button></div><div className="chat-placeholder"><strong>Общение игроков</strong><p>Чат станет доступен в одном из следующих обновлений.</p></div></div>}

    {error && <div className="battle-error" role="alert">{error}<button title="Закрыть" onClick={onClearError}><X size={16}/></button></div>}
    {leaveConfirm && createPortal(
      <div className="battle-exit-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setLeaveConfirm(false); }}>
        <div className="panel battle-confirm" role="dialog" aria-modal="true" aria-labelledby="battle-exit-title" aria-describedby="battle-exit-description">
          <h2 id="battle-exit-title">Покинуть отряд?</h2>
          <p id="battle-exit-description">Текущая партия для остальных продолжится без вас.</p>
          <div className="confirm-actions">
            <button className="button button-secondary" autoFocus onClick={()=>setLeaveConfirm(false)}>Остаться</button>
            <button className="button button-primary" onClick={()=>{setLeaveConfirm(false);onExit();}}><CheckCircle2 size={17}/> Выйти</button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </main>;
}
