import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('migrations upgrade original schema and retain atomic owner setup',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text,public boolean);CREATE TABLE storage.objects(id uuid,name text,bucket_id text);CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;`);
 const old=execFileSync('git',['show','4a064b3:supabase/schema.sql'],{encoding:'utf8'}).replace('create extension if not exists "pgcrypto";','');
 await db.exec(old);
 for(const file of ['202610150001_tenant_onboarding.sql','202610150002_atomic_import.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
 const org=await db.query(`SELECT * FROM create_organization('Migrated ISP','wireless')`);
 assert.equal(org.rows.length,1);assert.equal((await db.query('SELECT * FROM organization_members')).rows.length,1);
 }finally{await db.close()}
});
