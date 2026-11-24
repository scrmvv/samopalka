import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {BalanceStore} from '../src/balance.js';
import {adminRoutes} from '../src/adminRoutes.js';

test('4.1 HTTP: login, cookie authorization, CSRF, validation, conflict, logout',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'samopalka-http-'));
  const file=join(dir,'balance.json');const store=new BalanceStore(file);let notified=0;
  const app=express();app.use('/api/admin',adminRoutes(store,'test-password-1234',true,()=>notified++));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/`;
  const json={'Content-Type':'application/json','X-Samopalka-Admin':'1'};
  try{
    assert.equal((await fetch(url+'balance')).status,401);
    assert.equal((await fetch(url+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-password-1234'})})).status,403);
    assert.equal((await fetch(url+'login',{method:'POST',headers:json,body:JSON.stringify({password:'wrong'})})).status,401);
    const login=await fetch(url+'login',{method:'POST',headers:json,body:JSON.stringify({password:'test-password-1234'})});assert.equal(login.status,200);
    const setCookie=login.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly; SameSite=Strict/);
    const cookie=setCookie.split(';')[0]!;const headers={...json,Cookie:cookie};
    const get=await fetch(url+'balance',{headers:{Cookie:cookie}});assert.equal(get.status,200);assert.equal(get.headers.get('cache-control'),'no-store');const data=await get.json() as {balance:ReturnType<BalanceStore['snapshot']>};
    const b=data.balance;b.heroes.warrior.hp=22;b.artifacts['art-013']!.faceValue=8;b.spells['hero-adept-shield2']!.cost=4;b.effects.poison!.factor=3;
    assert.equal((await fetch(url+'balance',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(b)})).status,403);
    const invalid=structuredClone(b);invalid.heroes.warrior.hp=-1;
    const invalidSpell=structuredClone(b);invalidSpell.spells['hero-adept-shield2']!.cost=0;
    assert.equal((await fetch(url+'balance',{method:'PUT',headers,body:JSON.stringify(invalidSpell)})).status,400);
    assert.equal((await fetch(url+'balance',{method:'PUT',headers,body:JSON.stringify(invalid)})).status,400);
    assert.equal((await fetch(url+'balance',{method:'PUT',headers,body:JSON.stringify(b)})).status,200);assert.equal(notified,1);assert.equal(new BalanceStore(file).snapshot().heroes.warrior.hp,22);assert.equal(new BalanceStore(file).snapshot().artifacts['art-013']!.faceValue,8);assert.equal(new BalanceStore(file).snapshot().spells['hero-adept-shield2']!.cost,4);assert.equal(new BalanceStore(file).snapshot().effects.poison!.factor,3);
    assert.equal((await fetch(url+'balance',{method:'PUT',headers,body:JSON.stringify(b)})).status,409);
    assert.equal((await fetch(url+'logout',{method:'POST',headers})).status,200);
    assert.equal((await fetch(url+'balance',{headers:{Cookie:cookie}})).status,401);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
test('4.1 HTTP: secure transport required and unset password disables administration',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'samopalka-http-'));const store=new BalanceStore(join(dir,'balance.json'));const app=express();app.use('/secure',adminRoutes(store,'test-password-1234'));app.use('/disabled',adminRoutes(store,''));const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;try{assert.equal((await fetch(url+'/secure/balance')).status,403);assert.equal((await fetch(url+'/disabled/balance')).status,503);const response=await fetch(url+'/secure/login',{method:'POST',headers:{'Content-Type':'application/json','X-Samopalka-Admin':'1','X-Forwarded-Proto':'https'},body:JSON.stringify({password:'test-password-1234'})});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie')!,/; Secure/);}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
