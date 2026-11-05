import { NextRequest,NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { currentUser,newSession,tokenHash,sameOrigin } from '@/lib/session';
import { compare } from 'bcryptjs';
const err=(error:string,status=400)=>NextResponse.json({error},{status});
async function hash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Buffer.from(salt,'hex'),iterations:100000,hash:'SHA-256'},key,256)).toString('hex');}
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 if(!sameOrigin(req))return err('Invalid request origin',403);
 const {action}=await params;const sql=db();
 try{
 if(action==='logout'){const t=(await cookies()).get('np_session')?.value;if(t)await sql.query('delete from auth.sessions where token_hash=$1',[await tokenHash(t)]);(await cookies()).delete('np_session');return NextResponse.json({ok:true});}
 if(action==='delete-account'){
 const user=await currentUser();if(!user)return err('Not signed in',401);
 await sql.transaction([sql.query("select set_config('app.user_id',$1,true)",[user.id]),sql.query('delete from organizations where id in (select organization_id from organization_members where user_id=$1 and role=\'owner\')',[user.id]),sql.query('delete from auth.users where id=$1',[user.id])]);(await cookies()).delete('np_session');return NextResponse.json({ok:true});
 }
 if(!['signup','login'].includes(action))return err('Unknown action',404);
 const body=await req.json();const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';const password=body.password;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>128)return err('Enter a valid email and a password of 8-128 characters.');
 const ip=req.headers.get('cf-connecting-ip')||'unknown';const ipkey=await tokenHash('ip:'+action+':'+ip);
 const globalRate=await sql.query("insert into auth.rate_limits(key,attempts,reset_at) values($1,1,now()+interval '15 minutes') on conflict(key) do update set attempts=case when auth.rate_limits.reset_at<now() then 1 else auth.rate_limits.attempts+1 end,reset_at=case when auth.rate_limits.reset_at<now() then now()+interval '15 minutes' else auth.rate_limits.reset_at end returning attempts",[ipkey]);
 if(globalRate[0].attempts>30)return err('Too many attempts. Please try again in 15 minutes.',429);
 const key=await tokenHash(action+':'+ip+':'+email);
 const rates=await sql.query("insert into auth.rate_limits(key,attempts,reset_at) values($1,1,now()+interval '15 minutes') on conflict(key) do update set attempts=case when auth.rate_limits.reset_at<now() then 1 else auth.rate_limits.attempts+1 end,reset_at=case when auth.rate_limits.reset_at<now() then now()+interval '15 minutes' else auth.rate_limits.reset_at end returning attempts",[key]);
 if(rates[0].attempts>8)return err('Too many attempts. Please try again in 15 minutes.',429);
 let id:string;
 if(action==='signup'){
 const salt=Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');const encoded='pbkdf2$'+salt+'$'+await hash(password,salt);
 const rows=await sql.query('insert into auth.users(email,encrypted_password) values($1,$2) on conflict(email) do nothing returning id',[email,encoded]);if(!rows[0]){
 const existing=(await sql.query('select id,encrypted_password from auth.users where email=$1',[email]))[0];
 let match=false;if(existing?.encrypted_password.startsWith('pbkdf2$')){const [,oldSalt,expected]=existing.encrypted_password.split('$');match=await hash(password,oldSalt)===expected;}
 if(!match)return err('An account already exists. Please log in.');id=existing.id;
 }else id=rows[0].id;
 }else{
 const rows=await sql.query('select id,encrypted_password from auth.users where email=$1',[email]);const user=rows[0];let valid=false;
 if(user?.encrypted_password.startsWith('pbkdf2$')){const [,salt,expected]=user.encrypted_password.split('$');valid=(await hash(password,salt))===expected;}else if(user) valid=await compare(password,user.encrypted_password);
 if(!valid)return err('Email or password is incorrect.',401);id=user.id;
 }
 await newSession(id);return NextResponse.json({ok:true});
 }catch{ return err('Account service is temporarily unavailable. Please try again.',503); }
}
