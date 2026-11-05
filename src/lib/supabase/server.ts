/* eslint-disable @typescript-eslint/no-explicit-any */
// Compatibility facade for the existing views. Every operation runs in a
// transaction with a request-scoped user ID and PostgreSQL row-level security.
import { scoped } from '../db';
import { currentUser } from '../session';
const tables=new Set(['organizations','organization_members','uploads','customers','ip_addresses','equipment','health_reports','copilot_queries']);
const ident=(s:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(s))throw Error('Invalid identifier');return '"'+s+'"'};
type Result={data:any,error:any,count:number|null};
class Query implements PromiseLike<Result> {
 private fields='*';private filters:string[]=[];private values:unknown[]=[];private mode='select';private row:Record<string,unknown>|null=null;private one=false;private max=0;private sort='';private count=false;
 constructor(private table:string,private uid:string){if(!tables.has(table))throw Error('Unknown table');}
 select(fields='*',opts?:{count?:string,head?:boolean}){this.fields=fields==='*'?'*':fields.split(',').map(x=>ident(x.trim())).join(',');this.count=!!opts?.count;return this;}
 eq(k:string,v:unknown){this.values.push(v);this.filters.push(`${ident(k)}=$${this.values.length}`);return this;}
 is(k:string,_v:null){this.filters.push(`${ident(k)} is null`);return this;}
 not(k:string,_op:string,_v:null){this.filters.push(`${ident(k)} is not null`);return this;}
 lte(k:string,v:unknown){this.values.push(v);this.filters.push(`${ident(k)}<=$${this.values.length}`);return this;}
 order(k:string,o:{ascending:boolean}){this.sort=` order by ${ident(k)} ${o.ascending?'asc':'desc'}`;return this;}
 limit(n:number){this.max=Math.min(20000,Math.max(1,Math.floor(n)));return this;}
 single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
 insert(row:Record<string,unknown>){this.mode='insert';this.row=row;return this;}
 async execute():Promise<{data:any,error:any,count:number|null}>{
 try{
 if(!this.uid)throw Error('Not signed in');let text='';let values=this.values;
 if(this.mode==='insert'){const row=this.row!;const keys=Object.keys(row);values=Object.values(row).map(v=>typeof v==='object'&&v!==null?JSON.stringify(v):v);text=`insert into ${ident(this.table)} (${keys.map(ident)}) values (${keys.map((_,i)=>'$'+(i+1))}) returning *`;}
 else{text=`select ${this.count?'count(*)::int as count':this.fields} from ${ident(this.table)}${this.filters.length?' where '+this.filters.join(' and '):''}${this.sort}${this.max?' limit '+this.max:''}`;}
 const rows=await scoped(this.uid,text,values);return {data:this.one?rows[0]||null:rows,error:null,count:this.count?Number(rows[0].count):null};
 }catch(e){return {data:null,error:{message:e instanceof Error?e.message:'Database error'},count:null};}}
 then<TResult1=Result,TResult2=never>(a?:((value:Result)=>TResult1|PromiseLike<TResult1>)|null,b?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return this.execute().then(a,b);}
}
export async function createClient(){
 const user=await currentUser();const uid=user?.id||'';
 return {auth:{getUser:async()=>({data:{user}}),exchangeCodeForSession:async(_c:string)=>({error:{message:'Email links are no longer used. Please log in.'}})},from:(t:string)=>new Query(t,uid),
 rpc:async(name:string,args:Record<string,unknown>)=>{try{
 let rows;if(name==='create_organization')rows=await scoped(uid,'select * from create_organization($1,$2)',[args.p_name,args.p_isp_type]);
 else if(name==='commit_import')rows=await scoped(uid,'select * from commit_import($1,$2,$3::jsonb,$4,$5::jsonb)',[args.p_upload_id,args.p_entity,JSON.stringify(args.p_rows),args.p_summary,JSON.stringify(args.p_findings)]);
 else throw Error('Unsupported operation');return {data:rows[0],error:null};}catch(e){return {data:null,error:{message:e instanceof Error?e.message:'Database error'}};}},
 storage:{from:(_b:string)=>({
 upload:async(path:string,buffer:ArrayBuffer,opts:{contentType:string,upsert:boolean})=>{try{await scoped(uid,'insert into raw_files(path,organization_id,content,content_type) values($1,$2,$3,$4)',[path,path.split('/')[0],Buffer.from(buffer).toString('base64'),opts.contentType]);return {error:null};}catch(e){return {error:{message:e instanceof Error?e.message:'Upload failed'}};}},
 download:async(path:string)=>{const rows=await scoped(uid,'select content,content_type from raw_files where path=$1',[path]);return rows[0]?{data:new Blob([Buffer.from(rows[0].content,'base64')],{type:rows[0].content_type}),error:null}:{data:null,error:{message:'File not found'}};}
 })}};
}
export type DataClient=Awaited<ReturnType<typeof createClient>>;
