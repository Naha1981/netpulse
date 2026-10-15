import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
export const USER_A = '00000000-0000-0000-0000-000000000001';
export const USER_B = '00000000-0000-0000-0000-000000000002';
export async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text primary key,name text,public boolean);
    CREATE TABLE storage.objects(id uuid default gen_random_uuid(),name text,bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;`);
  await db.exec(readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists "pgcrypto";',''));
  await db.exec(`GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage TO authenticated;
    INSERT INTO auth.users VALUES ('${USER_A}'),('${USER_B}');`);
  return db;
}
export async function asUser(db:PGlite,id:string) {
  await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub='${id}';`);
}
export async function createOrg(db:PGlite,name:string) {
  return (await db.query<{id:string}>(`SELECT * FROM public.create_organization($1,'wireless')`,[name])).rows[0].id;
}
