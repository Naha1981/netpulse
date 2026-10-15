import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database,asUser,createOrg,USER_A,USER_B } from './database';
test('atomic onboarding and two-tenant row/storage isolation',async()=>{
 const db=await database();
 try {
  await asUser(db,USER_A); const a=await createOrg(db,'ISP A');
  assert.equal((await db.query('SELECT * FROM organizations')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM organization_members')).rows.length,1);
  const customerA=(await db.query<{id:string}>('INSERT INTO customers(organization_id,full_name) VALUES ($1,$2) RETURNING id',[a,'Private A'])).rows[0].id;
  await db.query('INSERT INTO storage.objects(name,bucket_id) VALUES ($1,$2)',[`${a}/file.csv`,'uploads']);
  await asUser(db,USER_B); const b=await createOrg(db,'ISP B');
  assert.equal((await db.query('SELECT * FROM customers')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
  await assert.rejects(db.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')`,[a,USER_B]),/row-level security/);
  await assert.rejects(db.query('INSERT INTO customers(organization_id,full_name) VALUES ($1,$2)',[a,'Attack']),/row-level security/);
  await assert.rejects(db.query('INSERT INTO storage.objects(name,bucket_id) VALUES ($1,$2)',[`${a}/attack.csv`,'uploads']),/row-level security/);
  await assert.rejects(db.query('INSERT INTO equipment(organization_id,customer_id) VALUES ($1,$2)',[b,customerA]),/foreign key/);
  await db.query('INSERT INTO customers(organization_id,full_name) VALUES ($1,$2)',[b,'Private B']);
  assert.deepEqual((await db.query('SELECT full_name FROM customers')).rows,[{full_name:'Private B'}]);
  await asUser(db,USER_A);
  assert.deepEqual((await db.query('SELECT full_name FROM customers')).rows,[{full_name:'Private A'}]);
  await db.exec(`RESET ROLE; SET request.jwt.claim.sub='';`);
  await assert.rejects(db.query(`SELECT public.create_organization('Anonymous','wireless')`),/Not signed in/);
  await asUser(db,USER_A);
  await assert.rejects(db.query(`SELECT public.create_organization('Invalid','unsupported')`),/Invalid ISP type/);
 }finally{await db.close()}
});
