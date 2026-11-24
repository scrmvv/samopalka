import express, { type Request, type Response, type NextFunction } from 'express';
import { AdminAuth, adminCookie, adminToken } from './adminAuth.js';
import { BalanceStore, BalanceError, BalanceConflict, balanceCatalogue } from './balance.js';
export function adminRoutes(store:BalanceStore, password:string, allowHttp=false, onSaved:()=>void=()=>{}) {
  const router=express.Router(),auth=new AdminAuth(password);
  const secure=(req:Request)=>req.secure||(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')&&req.get('x-forwarded-proto')==='https');
  router.use((req:Request,res:Response,next:NextFunction)=>{
    res.set('Cache-Control','no-store');
    if(!auth.enabled){res.status(503).json({error:'Админка отключена. Настройте ADMIN_PASSWORD (минимум 12 символов).'});return;}
    if(!allowHttp&&!secure(req)){res.status(403).json({error:'Админка доступна по HTTPS. Для локального теста разрешите ADMIN_ALLOW_HTTP=1.'});return;}
    if(!['GET','HEAD'].includes(req.method)&&req.get('x-samopalka-admin')!=='1'){res.status(403).json({error:'Запрос отклонён.'});return;}
    next();
  });
  router.use(express.json({limit:'256kb'}));
  router.post('/login',(req,res)=>{
    const result=auth.login(req.body?.password);
    if('error' in result){res.status(result.error==='limited'?429:401).json({error:result.error==='limited'?'Слишком много попыток. Повторите через 15 минут.':'Неверный пароль.'});return;}
    auth.logout(adminToken(req.headers.cookie));res.set('Set-Cookie',adminCookie(result.token,secure(req)));res.json({ok:true});
  });
  router.use((req:Request,res:Response,next:NextFunction)=>{if(!auth.valid(adminToken(req.headers.cookie))){res.status(401).json({error:'Войдите в админку.'});return;}next();});
  router.post('/logout',(req,res)=>{auth.logout(adminToken(req.headers.cookie));res.set('Set-Cookie',adminCookie('',secure(req)));res.json({ok:true});});
  router.get('/balance',(_,res)=>{res.json({...balanceCatalogue(),balance:store.snapshot()});});
  router.put('/balance',(req,res)=>{
    try{const balance=store.save(req.body);try{onSaved();}catch(err){console.error('Не удалось обновить лобби:',err);}res.json({balance});}catch(err){if(err instanceof BalanceError){res.status(err instanceof BalanceConflict?409:400).json({error:err.message});return;}console.error('Ошибка сохранения баланса:',err);res.status(500).json({error:'Не удалось сохранить баланс на диск.'});}
  });
  router.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{const status=(err as {status?:number})?.status;res.status(status===413?413:400).json({error:status===413?'Слишком большой запрос.':'Неверный формат запроса.'});});
  return router;
}
