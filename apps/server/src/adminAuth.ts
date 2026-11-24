import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
const TTL=8*60*60*1000, WINDOW=15*60*1000, MAX_ATTEMPTS=8;
export class AdminAuth {
  private sessions=new Map<string,number>();
  private failures:number[]=[];
  readonly enabled:boolean;
  constructor(private readonly password:string,private readonly now:()=>number=Date.now){this.enabled=password.length>=12;}
  login(password:unknown):{token:string}|{error:'disabled'|'limited'|'invalid'} {
    if(!this.enabled)return {error:'disabled'};
    const time=this.now();this.failures=this.failures.filter(t=>t>time-WINDOW);
    if(this.failures.length>=MAX_ATTEMPTS)return {error:'limited'};
    if(typeof password!=='string'||password.length>1024||!timingSafeEqual(createHash('sha256').update(password).digest(),createHash('sha256').update(this.password).digest())){this.failures.push(time);return {error:'invalid'};}
    this.failures=[];for(const [token,expiry] of this.sessions)if(expiry<=time)this.sessions.delete(token);
    if(this.sessions.size>=32)this.sessions.delete(this.sessions.keys().next().value!);
    const token=randomBytes(32).toString('hex');this.sessions.set(token,time+TTL);return {token};
  }
  valid(token:string):boolean {const expiry=this.sessions.get(token);if(expiry===undefined)return false;if(expiry<=this.now()){this.sessions.delete(token);return false;}return this.enabled;}
  logout(token:string){this.sessions.delete(token);}
}
export function adminToken(cookie:string|undefined){return /(?:^|;\s*)samopalka_admin=([a-f0-9]{64})(?:;|$)/.exec(cookie??'')?.[1]??'';}
export function adminCookie(token:string,secure:boolean){return `samopalka_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${token?28800:0}${secure?'; Secure':''}`;}
