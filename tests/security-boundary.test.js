import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/apontamentos.ts';
import {onRequest as emit} from '../functions/api/device-token.ts';
import {issue} from '../server/security.ts';
const secret='synthetic-test-secret-only-0123456789abcdef',device='11111111-1111-4111-8111-111111111111';
function mock(fail=false){const calls=[];return {calls,prepare(){calls.push('prepare');if(fail)throw Error('SQL SECRET STACK');return {bind(){return this},async all(){return {results:[]}}}},async batch(){calls.push('batch');if(fail)throw Error('SQL SECRET STACK');return []}}}
const body=dev=>({dispositivo:dev,data:'2026-11-04',dia:{sit:'A',sv:[]}});
const request=(payload,headers={},method='POST')=>new Request('https://app.test/api/apontamentos',{method,headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:typeof payload==='string'?payload:JSON.stringify(payload)})});
async function check(r,status){assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.doesNotMatch(await r.text(),/SQL|SECRET|STACK/)}
test('adulterado, expirado, alheio, lote misto e segredo fraco: zero acessos D1',async()=>{
 const valid=await issue({DEVICE_TOKEN_SECRET:secret},device,Math.floor(Date.now()/1000)+3600);
 const expired=await issue({DEVICE_TOKEN_SECRET:secret},device,1);
 for(const [token,payload,status,configuredSecret] of [[valid.slice(0,-4)+'AAAA',body(device),401,secret],[expired,body(device),401,secret],[valid,body('other'),403,secret],[valid,[body(device),body('other')],403,secret],[valid,body(device),503,'weak'],[valid,body(device),503,undefined]]){
  const DB=mock();await check(await onRequest({request:request(payload,{Authorization:'Bearer '+token}),env:{DB,DEVICE_TOKEN_SECRET:configuredSecret}}),status);assert.equal(DB.calls.length,0);
 }
});
test('parsing, content-type, Origin, método, erro DB e GET: respostas controladas no-store',async()=>{
 const token=await issue({DEVICE_TOKEN_SECRET:secret},device,Math.floor(Date.now()/1000)+3600),auth={Authorization:'Bearer '+token};
 for(const [payload,headers,method,status] of [['{',auth,'POST',400],[' '.repeat(1024*1024+1),auth,'POST',413],[body(device),{...auth,'Content-Type':'text/plain'},'POST',415],[body(device),{...auth,Origin:'https://evil.test'},'POST',403],[body(device),auth,'PUT',405],[null,{},'GET',401]]){
  const DB=mock();await check(await onRequest({request:request(payload,headers,method),env:{DB,DEVICE_TOKEN_SECRET:secret,ADMIN_KEY:'test'}}),status);assert.equal(DB.calls.length,0);
 }
 const DB=mock(true);await check(await onRequest({request:request(body(device),auth),env:{DB,DEVICE_TOKEN_SECRET:secret}}),503);
 await check(await onRequest({request:new Request('https://app.test/api/apontamentos?mes=2026-11',{headers:{'x-admin-key':'test'}}),env:{DB,ADMIN_KEY:'test'}}),503);
});
test('limite streaming cancela antes de ler o corpo inteiro',async()=>{
 let pulls=0,cancelled=false;
 const stream=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(128*1024));},cancel(){cancelled=true}});
 const token=await issue({DEVICE_TOKEN_SECRET:secret},device,Math.floor(Date.now()/1000)+3600);
 const req=new Request('https://app.test/api/apontamentos',{method:'POST',duplex:'half',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:stream});
 const DB=mock();await check(await onRequest({request:req,env:{DB,DEVICE_TOKEN_SECRET:secret}}),413);assert.ok(cancelled);assert.ok(pulls<=11);assert.equal(DB.calls.length,0);
});
test('emissão falha fechada, UUID inválido, Origin hostil e método restrito',async()=>{
 for(const [env,req,status] of [[{ADMIN_KEY:'a'},request({dispositivo:device},{'x-admin-key':'a'}),503],[{ADMIN_KEY:'a',DEVICE_TOKEN_SECRET:'weak'},request({dispositivo:device},{'x-admin-key':'a'}),503],[{ADMIN_KEY:'a',DEVICE_TOKEN_SECRET:secret},request({dispositivo:'bad'},{'x-admin-key':'a'}),400],[{},request({}, {Origin:'https://evil.test'}),403],[{},request(null,{},'GET'),405]])await check(await emit({request:req,env}),status);
});
