import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {app} from './app-harness.js';
import {calcDay} from '../public/domain.js';
const body=s=>s.match(/function aloc\(d,c\)\{[\s\S]*?\n\}/)[0];
test('aloc real permanece byte a byte como main e preserva soma de cada categoria',()=>{
 const before=execFileSync('git',['show','f165587dd819ff616a712817ee0ebd78e9109e1b:public/index.html'],{encoding:'utf8'});
 const after=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.equal(body(after).replace(/\r/g,''),body(before).replace(/\r/g,''));
 const a=app();
 for(const total of [0,1,7,483,528,611]){
  a.run(`globalThis.alloc = aloc({sv:[{peso:1},{peso:2},{peso:3}]},{n:${total},h50:${total},h100:${total}})`);
  for(const category of ['n','h50','h100'])assert.equal(a.context.alloc.reduce((sum,x)=>sum+x[category],0),total);
 }
});
test('categorias reais zero ocio, HE50, HE100 e zero produtivo',()=>{
 const d={sit:'T',e:'07:30',s:'18:18',as:'12:00',av:'13:00',sv:[{os:'0001',osc:'202600001',peso:1}]};
 assert.equal(calcDay(d,'2026-11-04').n,528);assert.equal(calcDay(d,'2026-11-04').h50,60);
 assert.equal(calcDay(d,'2026-11-07').h100,588);
 assert.equal(calcDay(d,'2026-11-02').h100,588);
 assert.equal(calcDay({...d,periodos_ociosos:[{inicio:'07:30',fim:'12:00'},{inicio:'13:00',fim:'18:18'}]},'2026-11-04').tot,0);
});

