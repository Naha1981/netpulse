import * as XLSX from 'xlsx';
import { TARGET_SCHEMAS, type EntityType } from '@/lib/ai/mapping';
import type { ParsedSpreadsheet } from './parseSpreadsheet';
import { validateIpAddresses, validateRequiredField, validateDuplicateSerials, validateExpiredWarranties } from '@/lib/ai/validate';
export type ImportEntity = Exclude<EntityType,'unknown'>;
export function prepareImport(parsed:ParsedSpreadsheet, entity:ImportEntity, mappings:unknown) {
 if (!Object.hasOwn(TARGET_SCHEMAS,entity) || !Array.isArray(mappings)) throw new Error('Invalid import mapping.');
 const allowed=new Set(TARGET_SCHEMAS[entity]);
 const targets=new Set<string>();
 const approved: {source_column:string;target_field:string}[]=[];
 for(const m of mappings) {
  if (!m || typeof m.source_column!=='string' || !parsed.headers.includes(m.source_column)) throw new Error('Unknown source column.');
  if(m.target_field===null || m.target_field==='')continue;
  if(typeof m.target_field!=='string' || !allowed.has(m.target_field))throw new Error('Unsupported destination field.');
  if(targets.has(m.target_field))throw new Error('Each destination field can only be mapped once.');
  targets.add(m.target_field);approved.push(m);
 }
 const required=entity==='customers'?'full_name':entity==='ip_addresses'?'ip_address':'serial_number';
 if(!targets.has(required))throw new Error(`Map the required ${required} column before importing.`);
 const rows=parsed.rows.map((row,index)=>{
  const result:Record<string,unknown>={};
  for(const m of approved){const v=row[m.source_column];result[m.target_field]=typeof v==='string'?v.trim():v??null;}
  const fail=(message:string):never=>{throw new Error(`Row ${index+2}: ${message}`)};
  if(!String(result[required]??'').trim())fail(`${required} is required.`);
  if(entity==='customers') {
   const status=String(result.status??'active').trim().toLowerCase();
   const aliases:Record<string,string>={active:'active',enabled:'active',suspended:'suspended',inactive:'suspended',disabled:'suspended',cancelled:'cancelled',canceled:'cancelled'};
   if(!aliases[status])fail('status must be active, suspended or cancelled.');result.status=aliases[status];
  }
  for(const field of ['is_reserved','is_active'])if(field in result){
   const v=String(result[field]??'').toLowerCase();
   if(!['true','false','yes','no','1','0'].includes(v))fail(`${field} must be yes/no or true/false.`);
   result[field]=['true','yes','1'].includes(v);
  }
  for(const field of ['gps_lat','gps_lng'])if(field in result){
   if(result[field]===''||result[field]===null)result[field]=null;
   else {const n=Number(result[field]);const limit=field==='gps_lat'?90:180;if(!Number.isFinite(n)||Math.abs(n)>limit)fail(`Invalid ${field}.`);result[field]=n;}
  }
  if('warranty_expiry' in result){
   const raw=result.warranty_expiry;
   if(raw===''||raw===null)result.warranty_expiry=null;
   else if(typeof raw==='number'){
    const d=XLSX.SSF.parse_date_code(raw);if(!d)fail('Invalid Excel warranty date.');
    result.warranty_expiry=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
   }else{
    const text=String(raw);const iso=/^\d{4}-\d{2}-\d{2}$/.test(text)?text:null;
    if(!iso||Number.isNaN(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)fail('Use an Excel date cell or YYYY-MM-DD for warranty dates.');
    result.warranty_expiry=iso;
   }
  }
  return result;
 });
 const findings=entity==='ip_addresses'?validateIpAddresses(rows):entity==='customers'?validateRequiredField(rows,'full_name','customer'):[...validateDuplicateSerials(rows),...validateExpiredWarranties(rows)];
 if(findings.some(f=>f.type==='invalid_ip_format'))throw new Error('Invalid IPv4 addresses found. Correct them before importing.');
 return {rows,findings};
}
