import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/apontamentos.ts';
import {confirmar,validateDay,calcDay,canonicalDay} from '../public/domain.js';
import {localD1} from './d1.js';
import {app} from './app-harness.js';
const day=()=>({sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:2}],periodos_ociosos:[]});
const request=body=>new Request('http://local/api/apontamentos',{method:'POST',body:JSON.stringify(body)});
const item=d=>({dispositivo:'fixture',data:'2026-11-04',funcao:'Sintética',dia:d});
const invalid=[
 ['invertido',d=>d.periodos_ociosos=[{inicio:'10:00',fim:'09:00'}]],
 ['fora jornada',d=>d.periodos_ociosos=[{inicio:'07:00',fim:'08:00'}]],
 ['sobrepostos',d=>d.periodos_ociosos=[{inicio:'09:00',fim:'10:00'},{inicio:'09:30',fim:'11:00'}]],
 ['almoço',d=>d.periodos_ociosos=[{inicio:'11:59',fim:'12:30'}]],
 ['almoço invertido',d=>d.av='11:00'],
 ['almoço fora jornada',d=>d.av='18:00'],
 ['almoço incompleto',d=>d.av=''],
 ['jornada invertida',d=>d.s='06:00'],
 ['HH:mm inválido',d=>d.e='25:00'],
 ['array null',d=>d.periodos_ociosos=null],
 ['período null',d=>d.periodos_ociosos=[null]],
 ['demais períodos',d=>d.periodos_ociosos=Array(101).fill({inicio:'09:00',fim:'09:01'})],
 ['peso inválido',d=>d.sv[0].peso=4],
];
for(const [name,mutate] of invalid)test('mesma validação real app/API: '+name,async()=>{
 const d=day();mutate(d);assert.ok(validateDay(d).length);assert.ok(calcDay(d,'2026-11-04').tot>=0);
 const a=app();a.context.fixture=d;assert.ok(a.run('erros(fixture,calc(fixture,"2026-11-04")).er.length'));
 const DB=localD1();const r=await onRequest({request:request(item(confirmar(d))),env:{DB}});
 assert.equal(r.status,400);assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM apontamentos').get().n,0);DB.sqlite.close();
});
test('limites adjacentes ao almoço e entre períodos são aceitos',()=>{
 const d={...day(),periodos_ociosos:[{inicio:'09:00',fim:'10:00'},{inicio:'10:00',fim:'12:00'},{inicio:'13:00',fim:'14:00'}]};
 assert.deepEqual(validateDay(d),[]);assert.equal(calcDay(d,'2026-11-04').ocioso,240);
});
test('API D1+SQLite reais: duplo envio converge em uma linha; GET retorna array canônico',async()=>{
 const DB=localD1(),d=day();d.periodos_ociosos=[{inicio:'09:00',fim:'09:15'}];
 for(let n=0;n<2;n++)assert.equal((await onRequest({request:request(item(confirmar(d))),env:{DB}})).status,200);
 assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM apontamentos').get().n,1);
 const get=new Request('http://local/api/apontamentos?mes=2026-11',{headers:{'x-admin-key':'synthetic-key'}});
 const r=await onRequest({request:get,env:{DB,ADMIN_KEY:'synthetic-key'}}),[row]=await r.json();
 assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(row.periodos_ociosos,d.periodos_ociosos);
 assert.deepEqual(row.dia.periodos_ociosos,d.periodos_ociosos);assert.equal(calcDay(row.dia,row.data).tot,513);DB.sqlite.close();
});
test('API rejeita OS sem consentimento, alteração após consentimento, conflito de arrays e data irreal',async()=>{
 for(const body of [item(day()),item({...confirmar(day()),s:'18:00'}),{...item(confirmar(day())),periodos_ociosos:[{inicio:'09:00',fim:'10:00'}]},{...item(confirmar(day())),data:'2026-02-30'},null,[null],[],Array(401).fill(item(day()))]){
  const DB=localD1();assert.equal((await onRequest({request:request(body),env:{DB}})).status,400);DB.sqlite.close();
 }
});
test('GET legado usa [] sem reescrever JSON legado; acesso administrativo permanece exigido',async()=>{
 const DB=localD1(),old=day();delete old.periodos_ociosos;
 DB.sqlite.prepare('INSERT INTO apontamentos(dispositivo,pessoa,data,dia) VALUES(?,?,?,?)').run('fixture','','2026-11-04',JSON.stringify(old));
 const r=await onRequest({request:new Request('http://local/api/apontamentos?mes=2026-11',{headers:{'x-admin-key':'test'}}),env:{DB,ADMIN_KEY:'test'}});
 assert.deepEqual((await r.json())[0].dia.periodos_ociosos,[]);
 assert.equal(DB.sqlite.prepare('SELECT dia FROM apontamentos').get().dia,JSON.stringify(old));
 assert.equal((await onRequest({request:new Request('http://local/api/apontamentos?mes=2026-11'),env:{DB,ADMIN_KEY:'test'}})).status,401);DB.sqlite.close();
});
test('O sem OS persiste intervalos explícitos; A/F sem OS continuam aceitos',async()=>{
 for(const sit of ['O','A','F']){
  const DB=localD1(),d=sit==='O'?canonicalDay({...day(),sit,sv:[]}):{sit,e:'',s:'',as:'',av:'',sv:[]};
  assert.equal((await onRequest({request:request(item(d)),env:{DB}})).status,200);
  const saved=JSON.parse(DB.sqlite.prepare('SELECT dia FROM apontamentos').get().dia);
  assert.equal(calcDay(saved,'2026-11-04').tot,0);
  if(sit==='O')assert.equal(saved.periodos_ociosos.length,2);DB.sqlite.close();
 }
});
test('limite 1 MiB e JSON inválido não preparam gravação',async()=>{
 const DB=localD1();
 for(const [body,status] of [['{',400],[' '.repeat(1024*1024+1),413]])assert.equal((await onRequest({request:new Request('http://local/api/apontamentos',{method:'POST',body}),env:{DB}})).status,status);
 DB.sqlite.close();
});
