import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/apontamentos.ts';
import {confirmar} from '../public/domain.js';
export const secret='synthetic-test-secret-only-0123456789abcdef';
export const admin='synthetic-admin-only';
export const device='11111111-1111-4111-8111-111111111111';
const payload=(dispositivo=device)=>({dispositivo,data:'2026-11-04',dia:confirmar({sit:'A',sv:[]})});
function mock(){let accesses=0,writes=0;return {get accesses(){return accesses},get writes(){return writes},prepare(){accesses++;return {bind(){return this},async all(){return {results:[]}}}},async batch(s){writes+=s.length;return []}}}
const env=DB=>({DB,ADMIN_KEY:admin,DEVICE_TOKEN_SECRET:secret});
const req=(body,headers={},method='POST')=>new Request('https://app.test/api/apontamentos',{method,headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
test('POST sem credencial rejeita antes de qualquer acesso D1',async()=>{
 const DB=mock();const r=await onRequest({request:req(payload()),env:env(DB)});
 assert.equal(r.status,401);assert.equal(DB.accesses,0);assert.equal(DB.writes,0);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
