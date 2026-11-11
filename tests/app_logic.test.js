import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from './app-harness.js';
test('cancelar e voltar conservam draft sem gravar; reabrir preserva histórico e fila',()=>{
 const a=app();a.run(`setD('2026-11-04');setT('e','08:00');setT('s','17:48');w.os='0001';okOS();conf();voltarCorrigir()`);
 assert.equal(a.store.get('apt'),undefined);assert.equal(a.store.get('apt_pend'),undefined);
 const draft=a.store.get('apt_drafts');a.run('conf();cancelarRevisao()');
 assert.equal(a.store.get('apt'),undefined);assert.equal(a.store.get('apt_drafts'),draft);
 a.run('conf();confirmarSalvar()');
 const saved=a.store.get('apt'),pending=a.store.get('apt_pend');
 a.run(`reabrir();setT('s','18:00');conf();cancelarRevisao()`);
 assert.equal(a.store.get('apt'),saved);assert.equal(a.store.get('apt_pend'),pending);
 a.run('cancelarEdicao()');assert.equal(a.run('dia().s'),'17:48');
});
test('A/F sem OS e O com horários válidos salvam sem exigir OS',()=>{
 for(const sit of ['A','F','O']){
  const a=app();a.run(`setD('2026-11-04');setS('${sit}')`);
  if(sit==='O')a.run(`setT('e','08:00');setT('s','17:00')`);
  a.run('conf();confirmarSalvar()');
  const d=JSON.parse(a.store.get('apt')).dias['dev|2026-11-04'];
  assert.equal(d.sit,sit);assert.equal(d.sv.length,0);
  if(sit==='O'){assert.equal(d.periodos_ociosos.length,1);assert.equal(a.run('calc(dia(),data).tot'),0);}
 }
});
test('fila legada com OS não é enviada nem reescrita ao abrir',async()=>{
 const saved=JSON.stringify({dias:{'dev|2026-11-04':{sit:'T',e:'08:00',s:'17:48',as:'',av:'',sv:[{os:'0001',osc:'202600001',peso:2}],ok:true}}});
 const pending=JSON.stringify({'dev|2026-11-04':1});
 const a=app({apt:saved,apt_pend:pending});let sent=0;
 a.context.fetch=async()=>{sent++;return {ok:true}};a.context.navigator.onLine=true;
 await a.run('enviarJa()');assert.equal(sent,0);assert.equal(a.store.get('apt'),saved);assert.equal(a.store.get('apt_pend'),pending);
 assert.match(a.run('txtSync()'),/revisar/);
});

