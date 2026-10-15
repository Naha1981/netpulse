import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,createOrg,USER_A,USER_B} from './database';
import {prepareImport} from '../src/lib/parsing/normalizeImport';
import {parseSpreadsheet} from '../src/lib/parsing/parseSpreadsheet';
import {validateIpAddresses} from '../src/lib/ai/validate';
import * as XLSX from 'xlsx';
const csv=(s:string)=>parseSpreadsheet(new TextEncoder().encode(s).buffer,'data.csv');
test('full-file validation, date/status normalization and protected mappings',()=>{
 const mapped=[{source_column:'Name',target_field:'full_name'},{source_column:'Status',target_field:'status'}];
 const data=prepareImport(csv('Name,Status\nJane,ACTIVE\nJohn,Canceled'),'customers',mapped);
 assert.equal(data.rows[0].status,'active');assert.equal(data.rows[1].status,'cancelled');
 assert.throws(()=>prepareImport(csv('Name,Status\nJane,active\n,active'),'customers',mapped),/Row 3/);
 assert.throws(()=>prepareImport(csv('Name,Status\nJane,mystery'),'customers',mapped),/status/);
 assert.throws(()=>prepareImport(csv('Name,Status\nJane,active'),'customers',[{source_column:'Name',target_field:'organization_id'}]),/Unsupported destination/);
 assert.throws(()=>prepareImport(csv('Name,Status\nJane,active'),'customers',[{source_column:'Name',target_field:'full_name'},{source_column:'Status',target_field:'full_name'}]),/only be mapped once/);
 assert.throws(()=>csv('Name,Phone\nJane,082,EXTRA\nSipho'),/Invalid CSV/);
 assert.equal(validateIpAddresses([{ip_address:''}])[0].type,'invalid_ip_format');
 const sheet=XLSX.utils.aoa_to_sheet([['Serial','Warranty'],['ABC',46388]]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'data');
 const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 const result=prepareImport(parseSpreadsheet(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'equipment.xlsx'),'equipment',[{source_column:'Serial',target_field:'serial_number'},{source_column:'Warranty',target_field:'warranty_expiry'}]);
 assert.equal(result.rows[0].warranty_expiry,'2027-01-01');
});
test('atomic import rolls back late errors, retries return same report and tenant boundary holds',async()=>{
 const db=await database();try{
  await asUser(db,USER_A);const org=await createOrg(db,'ISP A');
  const upload=(await db.query<{id:string}>(`INSERT INTO uploads(organization_id,storage_path,original_filename,status,file_sha256) VALUES ($1,'test','data.csv','analyzed','HASH1') RETURNING id`,[org])).rows[0].id;
  const commit=(rows:unknown[],id=upload)=>db.query<{id:string}>(`SELECT * FROM commit_import($1,'customers',$2::jsonb,'Summary','[]'::jsonb)`,[id,JSON.stringify(rows)]);
  const bad=Array.from({length:501},(_,i)=>({full_name:`Name ${i}`,status:i===500?'INVALID':'active'}));
  await assert.rejects(commit(bad),/check constraint/);
  assert.equal((await db.query('SELECT * FROM customers')).rows.length,0);
  assert.equal((await db.query<{status:string}>('SELECT status FROM uploads')).rows[0].status,'analyzed');
  const good=[{full_name:'Jane',status:'active'}];
  const report=(await commit(good)).rows[0].id;assert.equal((await commit(good)).rows[0].id,report);
  assert.equal((await db.query('SELECT * FROM customers')).rows.length,1);
  assert.equal((await db.query('SELECT * FROM health_reports')).rows.length,1);
  await assert.rejects(db.query(`INSERT INTO uploads(organization_id,storage_path,original_filename,status,file_sha256) VALUES ($1,'test2','data.csv','analyzed','HASH1')`,[org]),/unique constraint/);
  const otherUpload=(await db.query<{id:string}>(`INSERT INTO uploads(organization_id,storage_path,original_filename,status) VALUES ($1,'test3','data.csv','analyzed') RETURNING id`,[org])).rows[0].id;
  await assert.rejects(commit([{full_name:'Attack',organization_id:org}],otherUpload),/Unsupported destination/);
  await asUser(db,USER_B);await createOrg(db,'ISP B');
  await assert.rejects(commit(good),/Upload not found/);
  assert.equal((await db.query('SELECT * FROM customers')).rows.length,0);
 }finally{await db.close()}
});
