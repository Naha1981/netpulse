import { neon } from '@neondatabase/serverless';
export function db() { return neon(process.env.DATABASE_URL!); }
export async function scoped(userId:string, text:string, values:unknown[]=[]) {
 const sql=db(); const results=await sql.transaction([sql.query("select set_config('app.user_id',$1,true)",[userId]),sql.query(text,values)]); return results[1];
}
