import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from './app-harness.js';
const fill=a=>a.run(`setD('2026-11-04');setT('e','07:30');setT('s','17:18');setT('as','12:00');setT('av','13:00');w.os='1234';okOS();w.os='5678';okOS();w.os='1234';okOS();`);
test('app real mantém edições em drafts e lista TODAS OS antes de salvar',()=>{
 const a=app();fill(a);
 assert.equal(a.store.get('apt'),undefined,'Autosave não pode alterar histórico');
 assert.equal(a.store.get('apt_pend'),undefined,'Autosave não pode enfileirar');
 a.run('conf()');
 assert.match(a.element('#app').innerHTML,/202601234/);
 assert.match(a.element('#app').innerHTML,/202605678/);
 assert.match(a.element('#app').innerHTML,/Confirmar e salvar/);
 assert.equal(a.store.get('apt'),undefined);
 a.run('confirmarSalvar()');
});
test('CSV/JSON reais incluem tipo O, intervalos e totais diários',()=>{
 const a=app();fill(a);a.run("addIdle();setIdle(0,'inicio','09:00');setIdle(0,'fim','09:15');conf();confirmarSalvar()");
 const headers=a.run('CAB'),rows=a.run("linhas('2026-11')");
 assert.ok(headers.includes('periodos_ociosos'),'Coluna canônica ausente da exportação');
 const record=Object.fromEntries(headers.map((k,i)=>[k,rows[0][i]]));
 assert.equal(record.min_ociosos,15);assert.equal(record.min_produtivos,513);
 assert.match(record.periodos_ociosos,/09:00/);
});
