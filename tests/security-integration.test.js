import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from './app-harness.js';
import {gestor} from './gestor.test.js';
import {onRequest as emit} from '../functions/api/device-token.ts';
import {onRequest} from '../functions/api/apontamentos.ts';
import {localD1} from './d1.js';
test('emissão real → colar no app real → snapshot offline → D1 mock SQLite e export sem token',async()=>{
 const device='22222222-2222-4222-8222-222222222222',DB=localD1(),env={DB,ADMIN_KEY:'synthetic-admin',DEVICE_TOKEN_SECRET:'synthetic-test-secret-only-0123456789abcdef'};
 const issued=await emit({request:new Request('https://app.test/api/device-token',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':env.ADMIN_KEY},body:JSON.stringify({dispositivo:device})}),env});
 const {token}=await issued.json();const a=app({apt_dev:device});a.element('#deviceToken').value=token;a.run('autorizarAparelho()');
 assert.equal(a.element('#deviceToken').value,'');assert.equal(a.store.get('apt_device_token'),token);
 a.run(`setD('2026-11-04');setS('A');conf();confirmarSalvar()`);
 assert.ok(!a.store.get('apt').includes(token));assert.ok(!a.store.get('apt_pend').includes(token));
 assert.ok(!a.run("JSON.stringify(linhas('2026-11'))").includes(token));
 a.context.navigator.onLine=true;a.context.fetch=async(url,options)=>onRequest({request:new Request('https://app.test'+url,options),env});
 await a.run('enviarJa()');assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM apontamentos').get().n,1);assert.equal(a.store.get('apt_pend'),'{}');DB.sqlite.close();
});
test('dispatcher executa somente allowlist/argumentos literais, sem código arbitrário',()=>{
 const a=app();a.run(`dispatchAction("setS('A')",{})`);assert.equal(a.run('dia().sit'),'A');
 a.run(`dispatchAction("setT('e',this.value)",{value:'08:00'})`);assert.equal(a.run('dia().e'),'08:00');
 a.run(`dispatchAction("setFuncao(FUNCOES[0])",{})`);assert.equal(a.run('funcaoAtual'),'Auxiliar de Manutenção');
 a.run(`dispatchAction("setS(alert(1))",{});dispatchAction("constructor('evil')",{})`);assert.equal(a.run('dia().sit'),'A');
});
test('gestor escapa nomes, UUID e datas adversariais vindos do servidor',()=>{
 const g=gestor();g.run(`render([{dispositivo:'<img src=x onerror=alert(1)>',pessoa:'<script>evil</script>',data:'<img src=x>',dia:{sit:'A',sv:[]}}],'2026-11')`);
 assert.doesNotMatch(g.$('#lista').innerHTML,/<script>|<img/);assert.match(g.$('#lista').innerHTML,/&#60;/);
});
