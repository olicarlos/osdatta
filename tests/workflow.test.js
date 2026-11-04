import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const url=new URL('../public/workflow.js',import.meta.url);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const d=()=>({sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:1},{os:'1234',osc:'202601234',peso:3}],periodos_ociosos:[]});
test('draft e revisão não alteram apt/fila; aprovação offline persiste snapshot imutável',async()=>{
 assert.ok(existsSync(url),'Workflow real ainda ausente');
 const {Workflow}=await import(url),s=storage(),w=new Workflow(s),k='dev|2026-11-04';
 w.edit(k,d());assert.equal(s.getItem('apt'),null);assert.equal(s.getItem('apt_pend'),null);
 const payload=w.review(k,'Oficial');assert.equal(payload.dia.sv.length,2);
 assert.equal(s.getItem('apt'),null);assert.equal(s.getItem('apt_pend'),null);
 w.approve(k,payload);const expected=JSON.stringify(w.pending[k].payload);
 w.edit(k,{...d(),s:'18:00'});
 assert.equal(JSON.stringify(w.pending[k].payload),expected);
 const reloaded=new Workflow(s);
 assert.equal(JSON.stringify(reloaded.pending[k].payload),expected);
 assert.equal(reloaded.drafts[k].s,'18:00');
 reloaded.ack(k,payload);assert.equal(reloaded.pending[k],undefined);
});
test('remover e desfazer invalida revisão aberta mesmo com conteúdo igual',async()=>{
 const {Workflow}=await import(url),w=new Workflow(storage()),k='dev|2026-11-04';
 w.edit(k,d());const review=w.review(k,'Oficial');
 w.edit(k,{...d(),sv:d().sv.slice(0,1)});w.edit(k,d());
 assert.throws(()=>w.approve(k,review),/mudou/);
});
