import { useEffect, useState, type FormEvent } from 'react';
import './admin.css';

type HeroRow={hp:number;maxMana:number;faces:number[]};
type FoeRow={hp:number;strength:number|null;abilities:Record<string,number>};
type ContentKey='artifacts'|'spells'|'effects';
type Field={key:string;label:string;value:number;min:number;max:number};
type ContentRow={id:string;name:string;description:string;group:string;tier:number|null;fields:Field[]};
type Balance={revision:number;heroes:Record<string,HeroRow>;foes:Record<string,FoeRow>} & Record<ContentKey,Record<string,Record<string,number>>>;
const tabs=['heroes','monsters','bosses','artifacts','spells','effects'] as const;
type Tab=typeof tabs[number];
const tabNames:Record<Tab,string>={heroes:'Герои',monsters:'Монстры',bosses:'Боссы',artifacts:'Артефакты',spells:'Заклинания',effects:'Эффекты'};
const isContent=(t:Tab):t is ContentKey=>t==='artifacts'||t==='spells'||t==='effects';
type Catalogue={heroes:{id:string;name:string;title:string;faces:{kind:string;label:string;value:number}[]}[];foes:{id:string;name:string;floor:number;boss:boolean;description:string}[];abilityLabels:Record<string,string>;content:Record<ContentKey,ContentRow[]>;defaults:Balance;balance:Balance};
class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
async function api<T>(route:string,method='GET',body?:unknown):Promise<T>{
  const res=await fetch('/api/admin/'+route,{method,credentials:'same-origin',cache:'no-store',headers:{'X-Samopalka-Admin':'1',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const json=await res.json().catch(()=>({error:'Сервер админки не ответил.'}));if(!res.ok)throw new ApiError(res.status,json.error??'Ошибка запроса.');return json as T;
}
function NumberField({label,value,min=0,max=100,onChange,disabled=false}:{label:string;value:number;min?:number;max?:number;onChange:(n:number)=>void;disabled?:boolean}){return <label className="admin-field"><span>{label}</span><input type="number" min={min} max={max} step={1} required value={Number.isNaN(value)?'':value} disabled={disabled} onChange={e=>onChange(e.target.valueAsNumber)}/></label>;}
export function Admin(){
  const [data,setData]=useState<Catalogue|null>(null),[draft,setDraft]=useState<Balance|null>(null),[password,setPassword]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [tab,setTab]=useState<Tab>('heroes'),[query,setQuery]=useState(''),[floor,setFloor]=useState('all'),[group,setGroup]=useState('all'),[selected,setSelected]=useState('warrior');
  const load=async()=>{const d=await api<Catalogue>('balance');setData(d);setDraft(structuredClone(d.balance));};
  useEffect(()=>{let active=true;api<Catalogue>('balance').then(d=>{if(active){setData(d);setDraft(structuredClone(d.balance));}}).catch(e=>{if(active&&(!(e instanceof ApiError)||e.status!==401))setError(String(e.message??e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const dirty=!!data&&!!draft&&JSON.stringify(draft)!==JSON.stringify(data.balance);
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const fail=(e:unknown)=>{if(e instanceof ApiError&&e.status===401){setData(null);setDraft(null);}setError(e instanceof Error?e.message:String(e));};
  const login=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api('login','POST',{password});setPassword('');await load();}catch(e){fail(e);}finally{setBusy(false);}};
  const save=async(e:FormEvent)=>{e.preventDefault();if(!draft||!data)return;setBusy(true);setError('');setNotice('');try{const r=await api<{balance:Balance}>('balance','PUT',draft);setData({...data,balance:r.balance});setDraft(structuredClone(r.balance));setNotice('Сохранено. Новый баланс применяется в новых партиях.');}catch(e){fail(e);}finally{setBusy(false);}};
  const logout=async()=>{if(dirty&&!window.confirm('Выйти без сохранения изменений?'))return;setBusy(true);try{await api('logout','POST');setData(null);setDraft(null);setNotice('');setError('');}catch(e){fail(e);}finally{setBusy(false);}};
  const reload=async()=>{if(dirty&&!window.confirm('Отменить несохранённые изменения?'))return;setBusy(true);setError('');setNotice('');try{await load();}catch(e){fail(e);}finally{setBusy(false);}};
  const editHero=(id:string,patch:Partial<HeroRow>)=>setDraft(d=>d?{...d,heroes:{...d.heroes,[id]:{...d.heroes[id],...patch}}}:d);
  const editFoe=(id:string,patch:Partial<FoeRow>)=>setDraft(d=>d?{...d,foes:{...d.foes,[id]:{...d.foes[id],...patch}}}:d);
  if(loading)return <main className="admin-shell"><p>Загрузка административной панели…</p></main>;
  if(!data||!draft)return <main className="admin-login"><a href="/" className="admin-back">← В игру</a><form onSubmit={login} className="admin-panel"><span className="admin-kicker">САМОПАЛКА / 04</span><h1>Управление балансом</h1><p>Вход для администратора игры.</p><label className="admin-field"><span>Пароль</span><input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="admin-error">{error}</p>}<button className="admin-primary" disabled={busy}>{busy?'Вход…':'Войти'}</button></form></main>;
  const contentTab=isContent(tab)?tab:null;
  const contentRows=contentTab?data.content[contentTab]:[];
  const groups=[...new Set(contentRows.map(r=>r.group))];
  const list:{id:string;name:string;detail:string;search:string}[]=contentTab?
    contentRows.filter(r=>(group==='all'||r.group===group)&&(floor==='all'||r.tier===Number(floor))).map(r=>({id:r.id,name:r.name,detail:[r.group,r.tier===null?'':`Этаж ${r.tier}`,r.fields.length?`${r.fields.length} параметр(а)`:'Фиксированное правило'].filter(Boolean).join(' · '),search:r.description})):
    tab==='heroes'?data.heroes.map(r=>({id:r.id,name:r.name,detail:`${draft.heroes[r.id].hp} HP`,search:r.title})):
    data.foes.filter(r=>r.boss===(tab==='bosses')&&(floor==='all'||r.floor===Number(floor))).map(r=>({id:r.id,name:r.name,detail:`Этаж ${r.floor} · ${draft.foes[r.id].hp} HP`,search:r.description}));
  const q=query.trim().toLocaleLowerCase('ru-RU');
  const filtered=list.filter(r=>`${r.name} ${r.id} ${r.search}`.toLocaleLowerCase('ru-RU').includes(q));
  const current=filtered.find(x=>x.id===selected)??filtered[0];
  const hero=tab==='heroes'?data.heroes.find(x=>x.id===current?.id):undefined;
  const foe=tab==='monsters'||tab==='bosses'?data.foes.find(x=>x.id===current?.id):undefined;
  const row=contentRows.find(x=>x.id===current?.id);
  const h=hero?draft.heroes[hero.id]:undefined,f=foe?draft.foes[foe.id]:undefined;
  const editContent=(key:ContentKey,id:string,values:Record<string,number>)=>setDraft(d=>d?{...d,[key]:{...d[key],[id]:values}}:d);
  const resetCurrent=()=>{if(hero)editHero(hero.id,structuredClone(data.defaults.heroes[hero.id]));if(foe)editFoe(foe.id,structuredClone(data.defaults.foes[foe.id]));if(contentTab&&row)editContent(contentTab,row.id,structuredClone(data.defaults[contentTab][row.id]));setNotice('Исходные значения восстановлены в черновике. Нажмите «Сохранить».');};
  const within=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
  const valid=Object.entries(draft.heroes).every(([id,h])=>within(h.hp,1,500)&&within(h.maxMana,0,100)&&h.faces.every((v,i)=>within(v,0,data.heroes.find(x=>x.id===id)?.faces[i]?.kind==='empty'?0:100)))&&Object.values(draft.foes).every(f=>within(f.hp,1,500)&&(f.strength===null||within(f.strength,0,100))&&Object.entries(f.abilities).every(([k,v])=>within(v,k==='dying'?1:0,k==='dying'?10:100)))&&(['artifacts','spells','effects'] as const).every(key=>data.content[key].every(r=>r.fields.every(f=>within(draft[key][r.id][f.key],f.min,f.max))));
  return <main className="admin-shell">
    <header className="admin-head"><div><a href="/" className="admin-back">← В игру</a><span className="admin-kicker">САМОПАЛКА</span><h1>Баланс игры</h1><p>Редактор игровых параметров · ревизия {data.balance.revision}</p></div><button onClick={()=>void logout()} disabled={busy}>Выйти</button></header>
    <div className="admin-notice">Изменения действуют только в новых партиях. Названия, слова граней, условия применения и правила способностей не меняются.</div>
    <form onSubmit={save}>
      <div className="admin-toolbar"><div className="admin-tabs" role="group" aria-label="Каталоги">{tabs.map(t=><button type="button" key={t} className={t===tab?'active':''} onClick={()=>{setTab(t);setQuery('');setFloor('all');setGroup('all');setSelected('');}}>{tabNames[t]}</button>)}</div><span className="admin-dirty">{dirty?'Есть несохранённые изменения':'Все изменения сохранены'}</span></div>
      <div className="admin-layout">
        <aside className="admin-panel admin-list"><label className="admin-field"><span>Поиск</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, ID или описание"/></label>
          {tab!=='heroes'&&tab!=='effects'&&<label className="admin-field"><span>Этаж</span><select value={floor} onChange={e=>setFloor(e.target.value)}><option value="all">Все этажи</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
          {contentTab&&groups.length>1&&<label className="admin-field"><span>Категория</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">Все категории</option>{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></label>}
          <p className="admin-count">Найдено: {filtered.length}</p><div className="admin-items">{filtered.map(r=><button type="button" key={r.id} className={current?.id===r.id?'active':''} onClick={()=>setSelected(r.id)}><span>{r.name}</span><small>{r.detail}</small></button>)}{!filtered.length&&<p>Ничего не найдено.</p>}</div>
        </aside>
        <section className="admin-panel admin-editor"><fieldset disabled={busy}><legend>{current?.name??'Выберите карточку'}</legend>
          {hero&&h&&<><p>{hero.title}</p><div className="admin-fields"><NumberField label="Максимальное HP" value={h.hp} min={1} max={500} onChange={hp=>editHero(hero.id,{hp})}/><NumberField label="Лимит маны в конце хода" value={h.maxMana} onChange={maxMana=>editHero(hero.id,{maxMana})}/></div><h2>Грани кубика</h2><div className="admin-faces">{hero.faces.map((face,i)=><NumberField key={i} label={`${i+1}. ${face.label} (исходная грань)`} value={h.faces[i]} max={face.kind==='empty'?0:100} disabled={face.kind==='empty'} onChange={v=>editHero(hero.id,{faces:h.faces.map((x,j)=>j===i?v:x)})}/>)}</div></>}
          {foe&&f&&<><p>Этаж {foe.floor} · {foe.boss?'Босс':'Монстр'}</p><div className="admin-fields"><NumberField label="Максимальное HP" value={f.hp} min={1} max={500} onChange={hp=>editFoe(foe.id,{hp})}/>{f.strength!==null&&<NumberField label="Сила основной грани" value={f.strength} onChange={strength=>editFoe(foe.id,{strength})}/>}</div><h2>Исходная карточка</h2><pre>{foe.description}</pre>{Object.keys(f.abilities).length>0&&<><h2>Параметры способностей</h2><div className="admin-fields">{Object.entries(f.abilities).map(([k,v])=><NumberField key={k} label={data.abilityLabels[k]??k} value={v} min={k==='dying'?1:0} max={k==='dying'?10:100} onChange={n=>editFoe(foe.id,{abilities:{...f.abilities,[k]:n}})}/>)}</div></>}</>}
          {contentTab&&row&&<><p>{row.group}{row.tier!==null?` · Этаж ${row.tier}`:''} · {row.id}</p><h2>Исходная карточка</h2><pre>{row.description}</pre>{row.fields.length?<><h2>Числовые параметры</h2><div className="admin-fields">{row.fields.map(f=><NumberField key={f.key} label={`${f.label} (исходно ${f.value})`} value={draft[contentTab][row.id][f.key]} min={f.min} max={f.max} onChange={n=>editContent(contentTab,row.id,{...draft[contentTab][row.id],[f.key]:n})}/>)}</div></>:<p>{row.id.startsWith('spellcard-')?'Стоимость и силу связанного заклинания можно изменить во вкладке «Заклинания» (поиск по ID карточки).':'Нет редактируемых числовых параметров. Правило остаётся фиксированным.'}</p>}</>}
          {current&&(!contentTab||!!row?.fields.length)&&<button className="admin-reset" type="button" onClick={resetCurrent}>Сбросить параметры карточки</button>}
        </fieldset></section>
      </div>
      {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-notice" role="status">{notice}</p>}
      <div className="admin-save"><button type="button" disabled={busy} onClick={()=>void reload()}>Обновить / отменить</button><button type="submit" className="admin-primary" disabled={busy||!dirty||!valid}>{busy?'Сохранение…':'Сохранить изменения'}</button>{!valid&&<span className="admin-error">Проверьте допустимые значения во всех карточках.</span>}</div>
    </form></main>;
}
