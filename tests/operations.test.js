import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {app} from './app-harness.js';
import {Workflow} from '../public/workflow.js';
const valid={sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:2}],periodos_ociosos:[]};
test('CRUD real: adicionar 2, editar, remover e bloquear período inválido',()=>{
 const a=app();a.context.fixture=valid;a.run(`setD('2026-11-04');flow.edit(key(),fixture);addIdle();setIdle(0,'inicio','09:00');setIdle(0,'fim','09:15');addIdle();setIdle(1,'inicio','15:00');setIdle(1,'fim','15:30')`);
 assert.equal(a.run('calc(dia(),data).tot'),483);
 a.run(`setIdle(1,'fim','15:45')`);assert.equal(a.run('calc(dia(),data).ocioso'),60);
 a.run('rmIdle(0)');assert.equal(a.run('dia().periodos_ociosos.length'),1);
 assert.equal(a.run('calc(dia(),data).ocioso'),45);
 a.run("setIdle(0,'inicio','12:30');conf()");assert.equal(a.run('revisao'),null);
 assert.equal(a.store.get('apt'),undefined);assert.equal(a.store.get('apt_pend'),undefined);
});
test('troca tipo no draft conserva OS, horários e períodos manuais e exporta O',()=>{
 const a=app();a.context.fixture=valid;
 a.run(`setD('2026-11-04');flow.edit(key(),fixture);addIdle();setIdle(0,'inicio','09:00');setIdle(0,'fim','09:15');setS('O')`);
 assert.equal(a.run('calc(dia(),data).ocioso'),528);
 a.run("setS('T')");assert.equal(a.run('dia().periodos_ociosos[0].inicio'),'09:00');
 a.run("setS('O');conf();confirmarSalvar()");
 const row=a.run("linhas('2026-11')[0]"),headers=a.run('CAB');
 assert.equal(row[headers.indexOf('situacao')],'Dia ocioso');assert.equal(row[headers.indexOf('min_produtivos')],0);
 assert.equal(row[headers.indexOf('min_ociosos')],528);assert.equal(a.run('dia().sv.length'),1);
});
test('journal completa commit aprovado após crash sem perder snapshot',()=>{
 const map=new Map();let fail=false;
 const storage={getItem:k=>map.get(k)??null,setItem(k,v){if(fail&&k==='apt_pend')throw Error('quota simulada');map.set(k,String(v))},removeItem:k=>map.delete(k)};
 const w=new Workflow(storage),key='dev|2026-11-04';w.edit(key,valid);const p=w.review(key,'Sintética');
 fail=true;assert.throws(()=>w.approve(key,p),/quota/);assert.ok(map.get('apt_commit'));
 fail=false;const recovered=new Workflow(storage);
 assert.deepEqual(recovered.saved.dias[key],p.dia);assert.deepEqual(recovered.pending[key].payload,p);
 assert.equal(map.get('apt_commit'),undefined);assert.equal(recovered.drafts[key],undefined);
});
test('retry real esgota em 8 tentativas, respeita Retry-After e não reseta ao reiniciar',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 let w=new Workflow(storage);const key='dev|2026-11-04';w.edit(key,valid);const p=w.review(key,'Sintética');w.approve(key,p);
 for(let i=1;i<=8;i++){
  w.fail(key,p,429,60000,1000,()=>0);assert.equal(w.pending[key].attempts,i);assert.ok(w.pending[key].nextAt>=61000);
  w=new Workflow(storage);assert.equal(w.pending[key].attempts,i);
 }
 assert.equal(w.eligible(key,Infinity),false);assert.deepEqual(w.pending[key].payload,p);
});
test('SW real inclui módulos no precache e nunca intercepta API ou POST',()=>{
 const handlers={},context={self:{addEventListener:(n,h)=>handlers[n]=h},URL,location:{origin:'http://fixture'}};
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 const precache=vm.runInContext('ARQS',context);assert.ok(precache.includes('./domain.js'));assert.ok(precache.includes('./workflow.js'));
 for(const request of [{method:'GET',url:'http://fixture/api/apontamentos?mes=2026-11'},{method:'POST',url:'http://fixture/api/apontamentos'}]){
  let intercepted=false;handlers.fetch({request,respondWith(){intercepted=true}});assert.equal(intercepted,false);
 }
});
