import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const url = new URL('../public/domain.js', import.meta.url);
const fixture = () => ({sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:2}],periodos_ociosos:[{inicio:'09:00',fim:'09:15'},{inicio:'15:00',fim:'15:30'}]});
test('fonte compartilhada calcula 588 - 60 - 45 = 483', async () => {
 assert.ok(existsSync(url), 'Módulo real compartilhado ainda não implementado');
 const {calcDay,validateDay}=await import(url);
 assert.deepEqual(validateDay(fixture()),[]);
 assert.deepEqual(calcDay(fixture(),'2026-11-04'),{bruto:588,almoco:60,ocioso:45,descontado:105,tot:483,n:483,h50:0,h100:0});
});
test('Dia O gera intervalos explícitos excluindo almoço e mantém informação', async () => {
 const m=await import(url),d={...fixture(),sit:'O'};
 assert.equal(typeof m.canonicalDay,'function','Normalização real do Dia O ausente');
 const o=m.canonicalDay(d);
 assert.deepEqual(o.periodos_ociosos,[{inicio:'07:30',fim:'12:00'},{inicio:'13:00',fim:'17:18'}]);
 assert.equal(o.sv.length,1);
 assert.equal(m.calcDay(o,'2026-11-04').ocioso,528);
 assert.equal(m.calcDay(o,'2026-11-04').tot,0);
 assert.deepEqual(m.canonicalDay({...d,as:'',av:''}).periodos_ociosos,[{inicio:'07:30',fim:'17:18'}]);
});
