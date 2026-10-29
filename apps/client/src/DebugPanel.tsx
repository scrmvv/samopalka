import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { RoomSnapshot } from '@samopalka/shared';

type Props = {
  room: RoomSnapshot;
  playerId: string;
  busy: boolean;
  onAction: (event: string, payload: unknown) => void;
  onClose: () => void;
};
const WORDS = [
  {id:'strike',label:'Удар'}, {id:'shield',label:'Щит'}, {id:'heal',label:'Лечение'},
  {id:'mana',label:'Мана'}, {id:'empty',label:'Пусто'},
  {id:'dodge',label:'СамоУворот'}, {id:'taunt',label:'Самощит + Насмешка'}
];
const STAT_FIELDS = [
  {id:'hp',label:'Здоровье (HP)'},{id:'maxHp',label:'Макс. здоровье'},
  {id:'shield',label:'Щит'},{id:'mana',label:'Мана'},{id:'maxMana',label:'Макс. мана'}
] as const;
const EFFECTS = [
  {id:'poison',label:'Яд'}, {id:'weakness',label:'Слабость'}, {id:'stun',label:'Оглушение'},
  {id:'sleep',label:'Сон'}, {id:'paralysis',label:'Паралич'},
  {id:'dodge',label:'Уворот'}, {id:'regeneration',label:'Регенерация'}, {id:'decay',label:'Гниение'}
];

/** Local testing controls; every mutation is validated on the server for the room host. */
export function DebugPanel({room, playerId, busy, onAction, onClose}: Props) {
  const game=room.game!;
  const entities=game.combatants;
  const heroes=entities.filter(x=>x.kind==='hero');
  const allAlive=entities.filter(x=>x.alive);
  const [heroId,setHeroId]=useState(playerId);
  const [faceIndex,setFaceIndex]=useState('0');
  const [word,setWord]=useState('strike');
  const [faceValue,setFaceValue]=useState('2');
  const [statId,setStatId]=useState(playerId);
  const [statField,setStatField]=useState<(typeof STAT_FIELDS)[number]['id']>('hp');
  const [statValue,setStatValue]=useState('8');
  const [statusId,setStatusId]=useState(playerId);
  const [statusKind,setStatusKind]=useState('poison');
  const [statusAmount,setStatusAmount]=useState('1');
  const [foeId,setFoeId]=useState('boss');
  const [foeDefinition,setFoeDefinition]=useState('');
  const [rollFirst,setRollFirst]=useState('1');
  const [rollSecond,setRollSecond]=useState('6');
  const hero=heroes.find(x=>x.id===heroId)??heroes[0];
  const currentFace=hero?(game.diceFaces?.[hero.id]??[])[Number(faceIndex)]:undefined;
  const foe=entities.find(x=>x.id===foeId);
  const foeOptions=useMemo(()=>room.debug?.foes.filter(x=>x.boss===(foe?.kind==='boss'))??[],[room.debug,foe?.kind]);
  const canSubmit=!busy&&game.phase!=='finished'&&game.phase!=='rest'&&game.phase!=='paused';
  const statEntity=entities.find(e=>e.id===statId);

  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[onClose]);

  function selectHero(id:string){
    setHeroId(id);
    setFaceIndex('0');
  }
  function changeStatField(field:(typeof STAT_FIELDS)[number]['id']){
    setStatField(field);
    setStatValue(String(statEntity?.[field]??0));
  }
  return <div className="battle-debug-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="panel battle-debug-panel" role="dialog" aria-modal="true" aria-label="Тестовая панель Самопалки">
      <div className="battle-debug-heading">
        <h2>ТЕСТОВАЯ ПАНЕЛЬ</h2>
        <button className="battle-icon-button" type="button" onClick={onClose} title="Закрыть"><X size={17}/></button>
      </div>
      <p className="battle-debug-hint">Доступна только хосту при запуске сервера с DEBUG_TOOLS=1. Все изменения применяются на сервере и сразу видны игрокам. После новой партии настройки сбрасываются.</p>
      <div className="battle-debug-grid">
        <div className="battle-debug-section">
          <h3>ГРАНИ КУБИКА</h3>
          <label htmlFor="db-hero">Герой</label>
          <select id="db-hero" value={hero?.id??''} onChange={e=>selectHero(e.target.value)}>
            {heroes.map(h=><option key={h.id} value={h.id}>{room.players.find(p=>p.id===h.id)?.nickname??h.name} — {h.name}</option>)}
          </select>
          <div className="battle-debug-row" style={{marginTop:9}}>
            <div><label htmlFor="db-side">Сторона</label><select id="db-side" value={faceIndex} onChange={e=>setFaceIndex(e.target.value)}>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n+1}</option>)}</select></div>
            <div><label htmlFor="db-word">Слово</label><select id="db-word" value={word} onChange={e=>setWord(e.target.value)}>{WORDS.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}</select></div>
            <div><label htmlFor="db-wordval">Сила</label><input id="db-wordval" type="number" min={word==='empty'?0:1} max="20" value={faceValue} onChange={e=>setFaceValue(e.target.value)}/></div>
          </div>
          <div className="battle-debug-subnote">Сейчас: {currentFace?.label??'Не выбрана'}</div>
          <button className="battle-debug-submit" disabled={!canSubmit||!hero|| (hero.id===game.activePlayerId && game.phase!=='roll')} onClick={()=>onAction('debug:face',{playerId:hero?.id,index:Number(faceIndex),word,value:word==='empty'?0:Number(faceValue)})}>Применить грань</button>
          <div className="battle-debug-subnote">Грань активного героя меняется до его броска. Можно назначать только уже поддерживаемые действия.</div>
        </div>
        <div className="battle-debug-section">
          <h3>ХАРАКТЕРИСТИКИ</h3>
          <label htmlFor="db-stat-entity">Персонаж</label>
          <select id="db-stat-entity" value={statId} onChange={e=>{setStatId(e.target.value); const c=entities.find(x=>x.id===e.target.value);setStatValue(String(c?.[statField]??0));}}>
            {allAlive.map(c=><option key={c.id} value={c.id}>{c.kind==='boss'?'Босс':c.kind==='monster'?'Монстр':'Герой'} — {c.name} ({c.id.slice(0,8)})</option>)}
          </select>
          <div className="battle-debug-row" style={{marginTop:9}}>
            <div><label htmlFor="db-stat">Характеристика</label><select id="db-stat" value={statField} onChange={e=>changeStatField(e.target.value as typeof statField)}>{STAT_FIELDS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
            <div><label htmlFor="db-stat-value">Значение</label><input id="db-stat-value" type="number" min={statField==='hp'||statField==='maxHp'?1:0} max="500" value={statValue} onChange={e=>setStatValue(e.target.value)}/></div>
          </div>
          <div className="battle-debug-subnote">Текущее значение: {statEntity?.[statField]??'—'}</div>
          <button className="battle-debug-submit" disabled={!canSubmit||!statEntity?.alive} onClick={()=>onAction('debug:stat',{id:statId,field:statField,value:Number(statValue)})}>Изменить характеристику</button>
          <div className="battle-debug-subnote">Не используется для убийства: задавайте HP от 1. Поражение и победу проверяйте игровыми действиями.</div>
        </div>
        <div className="battle-debug-section">
          <h3>ЭФФЕКТЫ</h3>
          <label htmlFor="db-effect-target">Цель</label>
          <select id="db-effect-target" value={statusId} onChange={e=>setStatusId(e.target.value)}>{allAlive.map(c=><option key={c.id} value={c.id}>{c.name} — {c.id.slice(0,8)}</option>)}</select>
          <div className="battle-debug-row" style={{marginTop:9}}>
            <div><label htmlFor="db-effect">Состояние</label><select id="db-effect" value={statusKind} onChange={e=>setStatusKind(e.target.value)}>{EFFECTS.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
            <div><label htmlFor="db-amount">Сила</label><input id="db-amount" type="number" min="1" max="10" value={statusAmount} onChange={e=>setStatusAmount(e.target.value)}/></div>
          </div>
          <div className="battle-debug-row" style={{marginTop:10}}>
            <button disabled={!canSubmit} onClick={()=>onAction('debug:status',{id:statusId,kind:statusKind,amount:Number(statusAmount),mode:'add'})}>Наложить</button>
            <button disabled={!canSubmit} onClick={()=>onAction('debug:status',{id:statusId,kind:statusKind,mode:'clear'})}>Снять</button>
          </div>
          <div className="battle-debug-subnote">Яд, слабость, оглушение, сон, паралич, уворот, регенерация и гниение — уже реализованные состояния.</div>
        </div>
        <div className="battle-debug-section">
          <h3>ПРОТИВНИК</h3>
          <label htmlFor="db-foe-target">Кого заменить</label>
          <select id="db-foe-target" value={foe?.id??''} onChange={e=>{setFoeId(e.target.value);setFoeDefinition('');}}>{entities.filter(c=>c.kind!=='hero').map(c=><option key={c.id} value={c.id}>{c.kind==='boss'?'Босс':'Монстр'} — {c.name}</option>)}</select>
          <label htmlFor="db-foe-name" style={{marginTop:10}}>Выбрать из каталога</label>
          <select id="db-foe-name" value={foeDefinition} onChange={e=>setFoeDefinition(e.target.value)}>
            <option value="">Выберите...</option>
            {foeOptions.map(f=><option key={f.id} value={f.id}>Этаж {f.floor}: {f.name} ({f.hp} HP)</option>)}
          </select>
          <button className="battle-debug-submit" disabled={!canSubmit||!foe||!foeDefinition} onClick={()=>onAction('debug:foe',{id:foeId,foeId:foeDefinition})}>Подменить противника</button>
          <div className="battle-debug-subnote">Можно тестировать монстров и боссов из других этажей. Замена восстанавливает HP выбранного противника.</div>
        </div>
        <div className="battle-debug-section">
          <h3>КОНТРОЛЬ БРОСКА</h3>
          <p className="battle-debug-subnote">Текущий ход: {room.players.find(p=>p.id===game.activePlayerId)?.nickname??'нет'} · {game.phase}</p>
          <div className="battle-debug-row">
            <div><label htmlFor="db-roll-a">Кубик 1</label><select id="db-roll-a" value={rollFirst} onChange={e=>setRollFirst(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></div>
            <div><label htmlFor="db-roll-b">Кубик 2</label><select id="db-roll-b" value={rollSecond} onChange={e=>setRollSecond(e.target.value)}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></div>
          </div>
          <button className="battle-debug-submit" disabled={!canSubmit||game.phase!=='roll'} onClick={()=>{onAction('debug:roll',{first:Number(rollFirst),second:Number(rollSecond)});onClose();}}>Выдать результаты броска</button>
        </div>
        <div className="battle-debug-section">
          <h3>УПРАВЛЕНИЕ ВРЕМЕНЕМ</h3>
          <p className="battle-debug-subnote">При долгих тестах можно продлевать текущий ход. Изменение действует только на эту партию и текущий ход.</p>
          <button className="battle-debug-submit" disabled={!canSubmit||!['roll','choose','target'].includes(game.phase)} onClick={()=>onAction('debug:time',120)}>Добавить 120 секунд</button>
          <div className="battle-debug-subnote">Этот инструмент предназначен для тестирования, а не для постоянной настройки баланса.</div>
        </div>
      </div>
    </section>
  </div>;
}
