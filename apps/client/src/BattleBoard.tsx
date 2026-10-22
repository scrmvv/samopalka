
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Dice5, Heart, MessageSquare, ScrollText, X } from 'lucide-react';
import { HEROES, HERO_DICE, type DiceFace, type RoomSnapshot } from '@samopalka/shared';
import { HeroSprite } from './HeroSprite';
import { radialPosition, PLAYER_RING_RADIUS, MONSTER_RING_RADIUS } from './boardLayout';

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
  useEffect(()=> { const interval = window.setInterval(()=>setTick(Date.now()),200); return ()=>window.clearInterval(interval); },[]);
  const [serverOffset,setServerOffset] = useState(()=>game.serverTime-Date.now());
  useEffect(()=>{setServerOffset(game.serverTime-Date.now());},[game.serverTime]);
  const left = game.deadlineAt === null ? 0 : Math.max(0,Math.ceil((game.deadlineAt-tick-serverOffset)/1000));
  const mine = room.players.find(p=>p.id===playerId);
  const mineHero = HEROES.find(h=>h.id===mine?.heroId);
  const active = room.players.find(p=>p.id===game.activePlayerId);
  const myTurn = Boolean(mine && game.activePlayerId===mine.id && online);
  const canAct = myTurn && !busy && left>0;
  const faces = mine?.heroId ? HERO_DICE[mine.heroId] : [];
  const activeFaces = active?.heroId ? HERO_DICE[active.heroId] : [];
  const title = game.phase==='paused' ? 'ИГРА ПРИОСТАНОВЛЕНА' : myTurn ? 'ВАШ ХОД' : `ХОДИТ: ${active?.nickname ?? 'ИГРОК'}`;
  const awaiting = !online ? 'Соединение прервано. Возвращаемся в игру…' : game.phase==='paused' ? 'В комнате не осталось участников.' : myTurn ? game.phase==='roll' ? 'Бросьте два кубика.' : 'Выберите один из двух результатов.' : 'Ожидайте броска другого игрока.';
  const rolls = useMemo(()=>game.rolls?.map((n,i)=>({n,index:i,face: activeFaces[n-1]})) ?? [],[game.rolls,activeFaces]);
  const monsters = room.players.map((p, i) => ({ ownerId: p.id, ownerNickname: p.nickname, variant: MONSTER_VARIANTS[i % MONSTER_VARIANTS.length], name: `Монстр ${i+1}` }));

  return <main className="battle-shell battle-circular-shell">
    <div className="battle-topline">
      <div>
        <div className="overline">ПОДЗЕМЕЛЬЕ · {room.name}</div>
        <h1>ПУТЬ ПРОКЛЯТЫХ</h1>
        <p>ЭТАЖ {game.floor} <span>·</span> {title}</p>
      </div>
      <div className="battle-toolbar">
        <button type="button" className="battle-icon-button" onClick={()=>setChatOpen(v=>!v)} aria-pressed={chatOpen} title="Чат"><MessageSquare size={16}/></button>
        <div className={'battle-timer panel '+(left<=5?'urgent':'')}><Clock3 size={18}/><div className="battle-timer-value"><strong>{left}</strong><span>СЕК</span></div></div>
      </div>
    </div>

    <div className="battle-layout-circular">
      <section className="battle-stage-circle panel" aria-label="Круглое поле боя">
        <span className="battle-hidden-status" aria-live="polite">{awaiting}</span>
        <div className={`table-board players-${room.players.length}`}>
          <div className="table-ring ring-outer"/>
          <div className="table-ring ring-mid"/>
          <div className="table-ring ring-center"/>

          {room.players.map((p, index)=>{
            const hero = p.heroId ? HEROES.find(h=>h.id===p.heroId) : null;
            return <div key={p.id} className={'table-seat lane-'+(index%6)+' '+(p.id===playerId?'self ':'')+(p.id===game.activePlayerId?'active ':'')+(!p.connected?'offline':'')} style={radialPosition(index, room.players.length, PLAYER_RING_RADIUS)}>
              <div className="table-seat-card">
                <div className="table-seat-sprite">{p.heroId ? <HeroSprite id={p.heroId} compact/> : <div className="empty-seat">+</div>}</div>
                <strong>{p.nickname}{p.id===playerId?' · ВЫ':''}</strong>
                <small>{hero?.name ?? 'Герой не выбран'}</small>
                <span className="seat-hp"><Heart size={10} fill="currentColor"/> {hero?.hp ?? '?'}</span>
              </div>
            </div>;
          })}

          {monsters.map((monster, index)=>{
            const ownerActive = monster.ownerId === game.activePlayerId;
            return <div key={monster.ownerId} title={`Монстр напротив ${monster.ownerNickname}`} className={'table-monster lane-'+(index%6)+' '+(ownerActive?'active':'')} style={radialPosition(index, monsters.length, MONSTER_RING_RADIUS)}>
              <div className="table-monster-card">
                <EnemySprite variant={monster.variant}/>
                <strong>{monster.name}</strong>
                
              </div>
            </div>;
          })}

          <div className="table-boss-core">
            <div className="boss-card">
              <EnemySprite variant="boss"/>
              <strong>БОСС</strong>
              <small>Общая цель для всех игроков</small>
            </div>
          </div>
        </div>
      </section>

      <aside className="battle-side-column">
        <section className="battle-panel-combined panel">
          <div className="battle-section-heading compact">
            <h2><Dice5 size={16}/> КУБИК И АРТЕФАКТЫ</h2>
            <span>{mineHero?.name ?? 'Герой'}</span>
          </div>
          <div className="battle-six compact">{faces.map((face,index)=><DieCell key={index} face={face} number={index+1}/>)}</div>
          {game.phase==='choose' && game.rolls ? <>
            <div className="battle-choice-label">{myTurn ? 'ВЫПАЛИ ДВА РЕЗУЛЬТАТА — ВЫБЕРИТЕ ОДИН' : `РЕЗУЛЬТАТЫ БРОСКА: ${active?.nickname ?? 'ИГРОК'}`}</div>
            <div className="battle-roll-results compact">{rolls.map(result=><DieCell key={result.index} face={result.face} number={result.n} action={canAct?()=>onAction('game:choose',result.index):undefined} />)}</div>
          </> : <div className="battle-roll-note">Бросьте два кубика и выберите один результат.</div>}
          <div className="battle-artifact-stack">
            <div className="artifact-placeholder"><span>✦</span><div><strong>Артефакты</strong><small>Пока не получены</small></div></div>
            <div className="artifact-placeholder"><span>◆</span><div><strong>Эффекты</strong><small>Активных эффектов нет</small></div></div>
          </div>
          <div className="battle-action-buttons single-row">
            <button className="button button-primary" disabled={!canAct || game.phase!=='roll'} onClick={()=>onAction('game:roll',{})}><Dice5 size={18}/> Бросить кубики</button>
          </div>
          <button className="battle-pass-link" disabled={!canAct} onClick={()=>onAction('game:pass',{})}>Пропустить ход</button>
        </section>

        <section className="battle-log panel compact-log">
          <div className="battle-section-heading compact"><h2><ScrollText size={16}/> ЖУРНАЛ</h2><span>Ход партии</span></div>
          <div className="battle-events compact">{game.events.map(e=><p key={e.id} className={'battle-event event-'+e.kind}>{e.text}</p>)}</div>
        </section>

        <section className="battle-controls panel mini-controls"><button className="battle-leave" onClick={()=>setLeaveConfirm(true)}><ArrowLeft size={15}/> Покинуть игру</button></section>
      </aside>
    </div>

    {chatOpen && <div className="battle-chat-drawer panel" role="dialog" aria-label="Чат"><div className="battle-section-heading compact"><h2><MessageSquare size={16}/> ЧАТ</h2><button className="battle-icon-button" type="button" onClick={()=>setChatOpen(false)} title="Закрыть"><X size={14}/></button></div><div className="chat-placeholder"><strong>Общение игроков</strong><p>Чат станет доступен в одном из следующих обновлений.</p></div></div>}

    {error && <div className="battle-error" role="alert">{error}<button title="Закрыть" onClick={onClearError}><X size={16}/></button></div>}
    {leaveConfirm&&<div className="modal-backdrop"><div className="panel battle-confirm"><h2>Покинуть отряд?</h2><p>Текущая партия для остальных продолжится без вас.</p><div className="confirm-actions"><button className="button button-secondary" onClick={()=>setLeaveConfirm(false)}>Остаться</button><button className="button button-primary" onClick={()=>{setLeaveConfirm(false);onExit();}}><CheckCircle2 size={17}/> Выйти</button></div></div></div>}
  </main>;
}
