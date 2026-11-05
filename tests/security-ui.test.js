import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from './app-harness.js';
import {gestor} from './gestor.test.js';
test('sem token conserva histórico, fila e orçamento sem fetch; aprovação continua offline',async()=>{
 const a=app();a.run(`setD('2026-11-04');setS('A');conf();confirmarSalvar()`);
 const before=[a.store.get('apt'),a.store.get('apt_pend')];let requests=0;
 a.context.navigator.onLine=true;a.context.fetch=async()=>{requests++;return new Response('{}')};
 await a.run('enviarJa()');assert.equal(requests,0);assert.deepEqual([a.store.get('apt'),a.store.get('apt_pend')],before);
 assert.match(a.run('txtSync()'),/autoriza/i);
});
test('valores locais adversariais são texto e CSV neutraliza fórmulas sem mudar OS numérica',()=>{
 const a=app();a.run(`setT('e','\" onfocus=\"alert(1)');R()`);
 assert.doesNotMatch(a.element('#app').innerHTML,/value="" onfocus=/);
 assert.equal(a.run("csvCell('=SUM(1)')"),'"\'=SUM(1)"');
 assert.equal(a.run("csvCell('1234')"),'"1234"');
});
test('gestor limpa senha ao entrar e sair',()=>{
 const g=gestor();g.$('#senha').value='synthetic-password';g.run('entrar()');assert.equal(g.$('#senha').value,'');
 g.$('#senha').value='synthetic-password';g.run("document.querySelector('#sair').onclick()");assert.equal(g.$('#senha').value,'');
});
