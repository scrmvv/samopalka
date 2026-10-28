import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { HEROES, type Ack, type HeroId, type RoomSnapshot } from '@samopalka/shared';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, Clipboard, Copy, Crown, Link2, LockKeyhole, Plus, Radio, Settings2, Swords, Users, Wifi, WifiOff, X } from 'lucide-react';
import './style.css';
import './battle.css';
import { HeroSprite } from './HeroSprite';
import { BattleBoard } from './BattleBoard';

type NetworkInfo = { port: number; radmin: string[]; addresses: string[] };
type SessionResponse = { playerId: string; room: RoomSnapshot };
// Игровая сессия хранится отдельно для каждой вкладки. Две вкладки могут быть двумя игроками.
const storage = {
  area: (key: string) => key === 'token' || key === 'room' ? sessionStorage : localStorage,
  get: (key: string) => { try { return storage.area(key).getItem('samopalka:' + key) ?? ''; } catch { return ''; } },
  set: (key: string, val: string) => { try { storage.area(key).setItem('samopalka:' + key, val); } catch { /* private mode */ } },
  remove: (key: string) => { try { storage.area(key).removeItem('samopalka:' + key); } catch { /* private mode */ } }
};
function sessionToken() {
  let token = storage.get('token');
  // getRandomValues works on plain HTTP addresses (including Radmin VPN).
  // crypto.randomUUID may be unavailable outside HTTPS / localhost.
  if (!token) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    storage.set('token', token);
  }
  return token;
}
// Miniature 12x12 hero portraits. Crisp SVG pixels, no image downloads required.
const SOCKET = io({ autoConnect: false, reconnection: true });

function App() {
  const [online, setOnline] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState(() => storage.get('nickname'));
  const [tab, setTab] = useState<'create' | 'join'>(() => new URLSearchParams(location.search).get('room') ? 'join' : 'create');
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [newName, setNewName] = useState('Путь проклятых');
  const [newSlots, setNewSlots] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [net, setNet] = useState<NetworkInfo | null>(null);
  const [radminIp, setRadminIp] = useState(() => storage.get('radminIp'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionOptionsOpen, setConnectionOptionsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSlots, setEditSlots] = useState(5);

  const call = useCallback(<T,>(event: string, payload: unknown): Promise<Ack<T>> => new Promise(resolve => {
    SOCKET.timeout(7000).emit(event, payload, (err: Error | null, response: Ack<T>) => {
      if (err) resolve({ ok: false, error: 'Сервер не ответил. Проверьте соединение.' });
      else resolve(response);
    });
  }), []);

  useEffect(() => {
    let active = true;
    fetch('/api/network').then(r => r.json()).then((data: NetworkInfo) => { if (active) setNet(data); }).catch(() => {});
    function connected() {
      setOnline(true);
      const code = storage.get('room');
      if (code) {
        const name = storage.get('nickname');
        void call<SessionResponse>('room:join', { code, nickname: name || 'Игрок', token: sessionToken() }).then(reply => {
          if (!active) return;
          if (reply.ok) { setRoom(reply.data.room); setPlayerId(reply.data.playerId); }
          else {
            storage.remove('room');
            setRoom(null);
            setPlayerId('');
            setError(reply.error);
          }
        });
      }
    }
    function disconnected() { setOnline(false); }
    function received(snapshot: RoomSnapshot) { setRoom(snapshot); }
    function closed() { storage.remove('room'); setRoom(null); setPlayerId(''); setError('Комната закрыта.'); }
    function kicked(reason: string) { storage.remove('room'); setRoom(null); setPlayerId(''); setError(reason || 'Вы исключены из комнаты.'); window.setTimeout(() => SOCKET.connect(), 150); }
    function replaced() {
      storage.remove('room'); setRoom(null); setPlayerId('');
      setError('Эта сессия открыта в другом окне.');
      SOCKET.disconnect();
    }
    SOCKET.on('connect', connected);
    SOCKET.on('disconnect', disconnected);
    SOCKET.on('room:state', received);
    SOCKET.on('room:closed', closed);
    SOCKET.on('room:kicked', kicked);
    SOCKET.on('session:replaced', replaced);
    SOCKET.connect();
    return () => {
      active = false;
      SOCKET.off('connect', connected); SOCKET.off('disconnect', disconnected);
      SOCKET.off('room:state', received); SOCKET.off('room:closed', closed); SOCKET.off('room:kicked', kicked);
      SOCKET.off('session:replaced', replaced); SOCKET.disconnect();
    };
  }, [call]);

  const me = room?.players.find(p => p.id === playerId);
  const isHost = Boolean(me?.isHost);
  const needsConnectionAddress = !radminIp.trim() && !net?.radmin.length && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const inviteUrl = useMemo(() => {
    const host = radminIp.trim() || net?.radmin[0];
    const origin = host
      ? `http://${host.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/:\d+$/, '')}:${net?.port ?? 3000}`
      : location.origin;
    return room ? `${origin}/?room=${room.code}` : '';
  }, [radminIp, net, room]);

  async function act<T>(event: string, data: unknown, onSuccess?: (data: T) => void) {
    if (!online || busy) return;
    setBusy(true); setError('');
    try {
      const res = await call<T>(event, data);
      if (res.ok) onSuccess?.(res.data);
      else setError(res.error);
    } finally { setBusy(false); }
  }
  function saveNickname(value: string) { setNickname(value); storage.set('nickname', value); }
  function rememberSession(data: SessionResponse) {
    storage.set('room', data.room.code);
    setPlayerId(data.playerId); setRoom(data.room);
    setSettingsOpen(false);
    window.history.replaceState({}, '', '/');
  }
  async function createRoom(ev: React.FormEvent) {
    ev.preventDefault();
    await act<SessionResponse>('room:create', { nickname, name: newName, maxPlayers: newSlots, token: sessionToken() }, rememberSession);
  }
  async function joinRoom(ev: React.FormEvent) {
    ev.preventDefault();
    await act<SessionResponse>('room:join', { nickname, code: joinCode.toUpperCase().trim(), token: sessionToken() }, rememberSession);
  }
  async function leaveRoom() {
    // Leaving must never be blocked by the turn timer or another pending request.
    const clearSession = () => {
      storage.remove('room'); setRoom(null); setPlayerId(''); setError('');
      window.history.replaceState({}, '', '/');
    };
    if (!online) { clearSession(); return; }
    try { await call<boolean>('room:leave', {}); }
    finally { clearSession(); }
  }
  function openSettings() {
    if (!room) return;
    setEditName(room.name); setEditSlots(room.maxPlayers); setSettingsOpen(true);
  }
  async function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const el = document.createElement('textarea');
        el.value = text; el.style.position = 'fixed'; el.style.left = '-9999px';
        document.body.appendChild(el); el.select();
        if (!document.execCommand('copy')) throw new Error('Copy failed');
        el.remove();
      }
      setToast('Скопировано'); window.setTimeout(() => setToast(''), 2200);
    } catch { setToast('Скопировать не удалось — выделите текст вручную.'); window.setTimeout(() => setToast(''), 3000); }
  }

  return <div className="site">
    <div className="atmosphere" aria-hidden="true"><div className="orb orb-one"/><div className="orb orb-two"/><div className="noise"/></div>
    <header className="topbar">
      <div className="brand"><div className="brand-emblem"><img src="/favicon.svg" alt=""/></div><div><div className="brand-name">САМОПАЛКА</div><div className="brand-tag">ПУТЬ ПРОКЛЯТЫХ</div></div></div>
      <div className="top-right"><div className={'connection ' + (online ? 'connection-on' : 'connection-off')}>
        {online ? <Wifi size={15}/> : <WifiOff size={15}/>}<span>{online ? 'В сети' : 'Нет связи'}</span></div></div>
    </header>
    {!room ? <main className="entry wrap">
      <section className="intro"><div className="eyebrow"><span className="eyebrow-line"/> СОБЕРИ ОТРЯД И СПУСТИСЬ ВНИЗ</div>
      <h1>ШЕСТЬ ЭТАЖЕЙ.<br/><em>ОДИН ВЫХОД.</em></h1>
      <p>Выбери героя, собери отряд и пройди подземелье. Доверять остальным или выживать в одиночку — решать тебе.</p>
      <div className="intro-stats"><div><b>6</b><span>героев</span></div><div className="vertical-divider"/><div><b>6</b><span>этажей</span></div><div className="vertical-divider"/><div><b>2–6</b><span>игроков</span></div></div>
      <div className="dungeon-trail" aria-hidden="true"><div className="trail-label">ПУТЬ ПРОКЛЯТЫХ <span>·</span> 6 ЭТАЖЕЙ</div><div className="trail-floors">{['I','II','III','IV','V','VI'].map((floor, i) => <span key={floor} className={i === 0 ? 'trail-active' : ''}>{floor}</span>)}</div></div>
      </section>
      <section className="gate panel">
        <div className="panel-top"><span className="overline">ПРИВАЛ ПЕРЕД СПУСКОМ</span><span className="small-symbol">✣</span></div>
        <h2>Войти в подземелье</h2><p className="muted">Назови себя и собирай отряд.</p>
        <label className="field-label" htmlFor="nick">ВАШЕ ИМЯ</label><input id="nick" autoComplete="nickname" className="text-input" maxLength={20} value={nickname} onChange={e => saveNickname(e.target.value)} placeholder="Например, Странник"/>
        <div className="tab-bar"><button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')} type="button"><Plus size={17}/> Создать комнату</button><button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')} type="button"><Link2 size={17}/> Войти по коду</button></div>
        {tab === 'create' ? <form onSubmit={createRoom}>
          <label className="field-label" htmlFor="room-title">НАЗВАНИЕ КОМНАТЫ</label><input id="room-title" className="text-input" maxLength={48} minLength={3} value={newName} onChange={e => setNewName(e.target.value)}/>
          <label className="field-label" htmlFor="slots">КОЛИЧЕСТВО ИГРОКОВ</label><div className="select-wrap"><select id="slots" value={newSlots} onChange={e => setNewSlots(Number(e.target.value))}>{[2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 2 || n === 3 || n === 4 ? 'игрока' : 'игроков'}</option>)}</select><ChevronDown size={18}/></div>
          <button className="button button-primary full" disabled={!online || busy || nickname.trim().length < 2} type="submit">Создать комнату <ArrowRight size={18}/></button>
        </form> : <form onSubmit={joinRoom}>
          <label className="field-label" htmlFor="code">КОД КОМНАТЫ</label><input id="code" className="text-input code-input" maxLength={6} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="НАПРИМЕР, AB23CD"/>
          <button className="button button-primary full" disabled={!online || busy || nickname.trim().length < 2 || joinCode.length !== 6} type="submit">Войти в комнату <ArrowRight size={18}/></button>
        </form>}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="gate-footer"><LockKeyhole size={15}/><span>Без регистрации. Создай комнату или присоединись по коду.</span></div>
      </section>
    </main> : room.status === 'started' && room.game ? <BattleBoard room={room} playerId={playerId} online={online} busy={busy} error={error} onAction={(event, payload) => void act(event, payload)} onExit={() => void leaveRoom()} onClearError={() => setError('')} /> : <main className="lobby wrap">
      <div className="crumb"><button onClick={() => void leaveRoom()} disabled={busy}><ArrowLeft size={17}/> Покинуть комнату</button><span>/</span><span>{room.campaign}</span></div>
      <div className="lobby-head"><div><div className="eyebrow"><span className="eyebrow-line"/> {room.status === 'lobby' ? 'СБОР ОТРЯДА' : 'ОТРЯД ГОТОВ'}</div>
        <h1>{room.name}</h1><div className="lobby-sub"><Users size={17}/> {room.players.filter(p => p.connected).length} в сети · {room.players.length} из {room.maxPlayers} мест занято <span className="dot">·</span> Кампания: {room.campaign}</div></div>
        <div className="room-controls"><div className="room-code"><span>КОД КОМНАТЫ</span><strong>{room.code}</strong></div><button className="square-button" onClick={() => void copyText(room.code)} title="Копировать код"><Copy size={18}/></button>{isHost && room.status === 'lobby' && <button className="square-button" onClick={openSettings} title="Настроить комнату"><Settings2 size={19}/></button>}</div>
      </div>
      <div className="lobby-grid"><section className="members panel">
        <div className="section-title"><h2>Участники</h2><span className="count">{room.players.length} / {room.maxPlayers}</span></div>
        <div className="players">{Array.from({length: room.maxPlayers}, (_, i) => { const p = room.players[i]; const hero = HEROES.find(h => h.id === p?.heroId); return <div className={'player-line ' + (p ? '' : 'empty') + (p?.id === playerId ? ' own' : '') + (p?.ready && p?.connected ? ' member-ready' : '')} key={i}>
          <div className="player-avatar" style={hero ? {'--avatar-color': hero.color} as React.CSSProperties : undefined}>{hero ? <HeroSprite id={hero.id} compact/> : (p ? '◇' : <Plus size={17}/>)}</div>
          <div className="player-meta"><div className="player-name">{p?.nickname ?? 'Свободное место'}{p?.isHost && <Crown size={14} className="crown"/>}{p?.id === playerId && <span className="you">ВЫ</span>}</div><div className="player-class">{p ? (hero ? hero.name : 'Герой не выбран') : 'Ожидаем участника...'}</div></div>
          {p && <div className={'status ' + (p.connected ? p.ready ? 'status-ready' : 'status-wait' : 'status-away')}>{!p.connected ? 'Не в сети' : p.ready ? <><Check size={13}/> Готов</> : 'Не готов'}</div>}
        </div>; })}</div>
        {room.status === 'lobby' ? <div className="member-bottom"><div className="ready-note">{room.players.length < 2 ? 'Для старта требуется минимум два игрока.' : room.players.every(p => p.ready && p.connected) ? 'Все участники готовы к началу.' : 'Партия начнётся, когда все выберут героев и подтвердят готовность.'}</div>
          <div className="member-actions"><button className={'button ' + (me?.ready ? 'button-muted' : 'button-secondary')} disabled={busy || !me?.heroId} onClick={() => void act('room:ready', !me?.ready)}>{me?.ready ? <><CheckCheck size={18}/> Готовность подтверждена</> : <><Check size={18}/> Я готов</>}</button>
            {isHost && <button className="button button-primary" disabled={busy || room.players.length < 2 || room.players.some(p => !p.ready || !p.connected)} onClick={() => void act('room:start', {})}>Начать партию <ArrowRight size={18}/></button>}</div>
        </div> : <div className="preview-active"><CheckCheck size={22}/><strong>Отряд собран</strong><p>Можно отправляться в подземелье.</p></div>}
      </section>
      <section className="selection panel"><div className="section-title"><div><span className="overline">ВЫБОР ПЕРСОНАЖА</span><h2>{room.status === 'lobby' ? 'Выбери героя' : 'Твой отряд'}</h2></div><div className="selection-icon"><Swords size={19}/></div></div>
        <p className="muted selection-descr">{room.status === 'lobby' ? 'У каждого героя свои способности. Несколько игроков могут выбрать один класс.' : 'Выбранные герои готовы к спуску.'}</p>
        <div className="hero-grid">{HEROES.map(hero => { const claimed = room.players.some(p => p.id !== playerId && p.heroId === hero.id); const selected = me?.heroId === hero.id; const inParty = room.status !== 'lobby' && claimed; return <button key={hero.id} className={'hero ' + (selected ? 'hero-selected' : '') +  + (inParty ? ' hero-party' : '') + (room.status !== 'lobby' ? ' hero-locked' : '')} style={{ '--hero-color': hero.color } as React.CSSProperties} disabled={busy || room.status !== 'lobby'} onClick={() => void act('room:hero', hero.id as HeroId)}>
          <div className="hero-symbol"><HeroSprite id={hero.id}/></div><div className="hero-body"><div className="hero-name">{hero.name}</div><div className="hero-title">{hero.title}</div><div className="hero-vitals"><span className="hero-vitals-label">ЗДОРОВЬЕ</span><span className="hero-hp">♥ <b>{hero.hp}</b></span></div></div>{selected && <span className="hero-check" title="Ваш герой"><Check size={13}/></span>}
        </button>; })}</div>
      </section></div>
      <section className="invite panel">
        <div className="invite-heading"><div className="invite-mark"><Radio size={20}/></div><div><h3>Пригласить друзей</h3><p>Скопируй ссылку или передай друзьям код комнаты.</p></div></div>
        <div className="invite-tools">
          <label className="invite-url"><span>ССЫЛКА-ПРИГЛАШЕНИЕ</span><input value={inviteUrl} readOnly onFocus={e => e.target.select()}/></label>
          <button className="button button-secondary copy-url" onClick={() => void copyText(inviteUrl)}><Clipboard size={16}/> Копировать</button>
        </div>
        <div className="invite-bottom">
          <span>Можно войти и по коду: <strong>{room.code}</strong></span>
          <button type="button" className="invite-settings-toggle" aria-expanded={connectionOptionsOpen} onClick={() => setConnectionOptionsOpen(v => !v)}><Settings2 size={15}/> {connectionOptionsOpen ? 'Скрыть настройки' : 'Настроить приглашение'}</button>
        </div>
        {needsConnectionAddress && <div className="invite-warning">Укажи адрес своей сети в настройках приглашения, чтобы друзья могли подключиться.</div>}
        {connectionOptionsOpen && <div className="invite-advanced"><label className="invite-ip"><span>АДРЕС ВЕДУЩЕГО</span><input value={radminIp} placeholder={net?.radmin[0] ?? 'Например, 26.16.27.89'} onChange={e => { setRadminIp(e.target.value); storage.set('radminIp', e.target.value); }}/></label><p>Если ссылка ведёт не на тот адрес, впиши здесь IP компьютера, на котором запущена игра.</p></div>}
      </section>
      {error && <div className="error error-room" role="alert">{error}<button onClick={() => setError('')} title="Закрыть"><X size={15}/></button></div>}
    </main>}
    <footer className="site-footer"><span>САМОПАЛКА</span><span>6 ЭТАЖЕЙ · ОДИН ВЫХОД</span></footer>
    {settingsOpen && room && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><div className="settings panel" role="dialog" aria-modal="true" aria-label="Настройки комнаты"><button className="modal-close" onClick={() => setSettingsOpen(false)}><X size={20}/></button><span className="overline">НАСТРОЙКИ КОМНАТЫ</span><h2>Управление лобби</h2><label className="field-label" htmlFor="edit-name">НАЗВАНИЕ</label><input className="text-input" id="edit-name" maxLength={48} value={editName} onChange={e => setEditName(e.target.value)}/><label className="field-label" htmlFor="edit-slots">МЕСТ ДЛЯ ИГРОКОВ</label><div className="select-wrap"><select id="edit-slots" value={editSlots} onChange={e => setEditSlots(Number(e.target.value))}>{[2,3,4,5,6].filter(n => n >= room.players.length).map(n => <option key={n} value={n}>{n}</option>)}</select><ChevronDown size={18}/></div><button className="button button-primary full" disabled={busy} onClick={() => void act('room:settings', {name: editName, maxPlayers: editSlots}, () => setSettingsOpen(false))}>Сохранить <Check size={18}/></button></div></div>}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
