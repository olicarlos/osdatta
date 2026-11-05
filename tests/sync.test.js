import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from './app-harness.js';
import {authorizedHandler,devToken} from './auth-fixture.js';
const onRequest=authorizedHandler('dev');
import {localD1} from './d1.js';
const setup=()=>{
 const a=app({apt_device_token:devToken});a.run(`setD('2026-11-04');setT('e','07:30');setT('s','17:18');setT('as','12:00');setT('av','13:00');w.os='1234';okOS();conf();confirmarSalvar()`);return a;
};
test('offline aprovado → reload → sync usa payload JSON idêntico, nunca draft editado',async()=>{
 const a=setup(),payload=JSON.parse(a.store.get('apt_pend'))['dev|2026-11-04'].payload;
 a.run(`reabrir();setT('s','18:00');w.os='9999';okOS()`);
 const b=app(Object.fromEntries(a.store));b.context.navigator.onLine=true;
 const DB=localD1(),sent=[];
 b.context.fetch=async(url,options)=>{sent.push(options.body);return onRequest({request:new Request('http://local'+url,options),env:{DB}})};
 await b.run('enviarJa()');
 assert.deepEqual(sent,[JSON.stringify(payload)]);
 assert.deepEqual(JSON.parse(b.store.get('apt_pend')),{});
 assert.equal(JSON.parse(b.store.get('apt_drafts'))['dev|2026-11-04'].s,'18:00');
 const persisted=JSON.parse(DB.sqlite.prepare('SELECT dia FROM apontamentos').get().dia);
 assert.deepEqual(persisted,payload.dia);DB.sqlite.close();
});
test('perda de ack após sucesso permite retry idempotente sem criar outra linha',async()=>{
 const a=setup(),DB=localD1();a.context.navigator.onLine=true;
 a.context.fetch=async(url,options)=>{await onRequest({request:new Request('http://local'+url,options),env:{DB}});throw Error('ack perdido')};
 await a.run('enviarJa()');assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM apontamentos').get().n,1);
 assert.equal(a.run("pend['dev|2026-11-04'].attempts"),1);
 a.run("pend['dev|2026-11-04'].nextAt=0");
 a.context.fetch=async(url,options)=>onRequest({request:new Request('http://local'+url,options),env:{DB}});
 await a.run('enviarJa()');assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM apontamentos').get().n,1);
 assert.deepEqual(JSON.parse(a.store.get('apt_pend')),{});DB.sqlite.close();
});
test('ack antigo não remove snapshot mais recente aprovado durante envio',async()=>{
 const a=setup();a.context.navigator.onLine=true;
 a.context.fetch=async()=>{a.run(`reabrir();setT('s','18:00');conf();confirmarSalvar()`);return new Response('{}',{status:200})};
 await a.run('enviarJa()');
 assert.equal(JSON.parse(a.store.get('apt_pend'))['dev|2026-11-04'].payload.dia.s,'18:00');
});
test('erro permanente não faz fallback nem loop; orçamento transitório persiste após reload',async()=>{
 for(const status of [400,401,403,429,500]){
  const a=setup();a.context.navigator.onLine=true;let attempts=0;
  a.context.fetch=async()=>{attempts++;return new Response('{}',{status,headers:{'Retry-After':'10'}})};
  await a.run('enviarJa()');await a.run('enviarJa()');assert.equal(attempts,1);
  const q=JSON.parse(a.store.get('apt_pend'))['dev|2026-11-04'];
  assert.equal(q.attempts,[401,403].includes(status)?0:status<429?8:1);if(![401,403].includes(status))assert.ok(q.nextAt>Date.now());
  const b=app(Object.fromEntries(a.store));assert.equal(b.run("pend['dev|2026-11-04'].attempts"),q.attempts);
 }
});
