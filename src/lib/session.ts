import { cookies } from 'next/headers';
import { db } from './db';
export async function tokenHash(token:string) {return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');}
export async function currentUser(){
 const token=(await cookies()).get('np_session')?.value;if(!token)return null;
 const rows=await db().query('select u.id,u.email from auth.sessions s join auth.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()',[await tokenHash(token)]);return rows[0]||null;
}
export async function newSession(userId:string){
 const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');await db().query("insert into auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '7 days')",[await tokenHash(token),userId]);
 (await cookies()).set('np_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
}
export function sameOrigin(request:Request){ const origin=request.headers.get('origin');return !!origin&&(origin===new URL(request.url).origin||origin===process.env.NEXT_PUBLIC_SITE_URL); }
