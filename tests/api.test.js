import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/apontamentos.ts';
import {confirmar} from '../public/domain.js';
const day=()=>({sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:2}],periodos_ociosos:[{inicio:'09:00',fim:'09:15'},{inicio:'15:00',fim:'15:30'}]});
function db(){const calls=[];return {calls,prepare(query){const stmt={query,values:[],bind(...v){this.values=v;return this},async all(){return {results:[]}}};return stmt},async batch(statements){calls.push(...statements);return []}}}
const post=(dia,extra={})=>new Request('http://local/api/apontamentos',{method:'POST',body:JSON.stringify({dispositivo:'dev',data:'2026-11-04',dia,...extra})});
test('API real rejeita overlap antes de preparar qualquer gravação',async()=>{
 const DB=db(),d=day();d.periodos_ociosos.push({inicio:'09:10',fim:'09:30'});
 const r=await onRequest({request:post(confirmar(d)),env:{DB}});
 assert.equal(r.status,400);assert.equal(DB.calls.length,0);
});
test('API rejeita null mesmo em Dia O em vez de descartar entrada inválida',async()=>{
 const DB=db(),d={...day(),sit:'O',sv:[],periodos_ociosos:null};
 assert.equal((await onRequest({request:post(d),env:{DB}})).status,400);
});
