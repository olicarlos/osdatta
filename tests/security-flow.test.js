import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/apontamentos.ts';
import {confirmar} from '../public/domain.js';
const secret='synthetic-test-secret-only-0123456789abcdef',admin='synthetic-admin-only',device='11111111-1111-4111-8111-111111111111';
const payload=(dispositivo=device)=>({dispositivo,data:'2026-11-04',dia:confirmar({sit:'A',sv:[]})});
function mock(){let accesses=0,writes=0;return {get accesses(){return accesses},get writes(){return writes},prepare(){accesses++;return {bind(){return this},async all(){return {results:[]}}}},async batch(s){writes+=s.length;return []}}}
const req=(body,headers={},method='POST')=>new Request('https://app.test/api/apontamentos',{method,headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
test('gestor emite autorização e handler real grava só aparelho autorizado',async()=>{
 const {onRequest:emit}=await import('../functions/api/device-token.ts');
 const DB=mock(),env={DB,ADMIN_KEY:admin,DEVICE_TOKEN_SECRET:secret};
 for(const key of ['', 'wrong']){
  const r=await emit({request:req({dispositivo:device},{'x-admin-key':key}),env});assert.equal(r.status,401);
 }
 const r=await emit({request:req({dispositivo:device},{'x-admin-key':admin}),env});assert.equal(r.status,200);
 const {token}=await r.json();assert.ok(token);
 const result=await onRequest({request:req(payload(),{Authorization:'Bearer '+token}),env});
 assert.equal(result.status,200);assert.equal(DB.writes,1);
});
