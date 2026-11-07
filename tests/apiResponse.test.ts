import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../src/lib/apiResponse';
test('proxy HTML and rate limits produce safe user text instead of JSON parser noise',async()=>{
 await assert.rejects(readApiResponse(new Response('<!doctype html>upstream error',{status:502})),/service could not complete/);
 await assert.rejects(readApiResponse(new Response('<html>Rate limit</html>',{status:429})),/Wait a few minutes/);
 await assert.rejects(readApiResponse(new Response('null')),/invalid response/);
 assert.deepEqual(await readApiResponse(Response.json({error:'Invalid IPv4'})),{error:'Invalid IPv4'});
 assert.deepEqual(await readApiResponse(Response.json({uploadId:'synthetic'})),{uploadId:'synthetic'});
});
