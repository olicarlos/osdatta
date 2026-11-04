import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as domain from '../public/domain.js';
export function gestor(){
 const els=new Map();const $=s=>{if(!els.has(s))els.set(s,{innerHTML:'',value:'',style:{},focus(){},addEventListener(){}});return els.get(s)};
 const context={...domain,document:{querySelector:$},sessionStorage:{getItem(){return null}},setTimeout(){},Date};
 vm.createContext(context);
 const source=readFileSync(new URL('../public/conferencia.html',import.meta.url),'utf8').match(/<script(?: type="module")?>([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/gm,'');
 vm.runInContext(source,context);return {run:c=>vm.runInContext(c,context),$};
}
test('gestor real mostra cada intervalo e totais iguais ao app',()=>{
 const g=gestor();g.run(`render([{dispositivo:'synthetic',data:'2026-11-04',dia:{sit:'T',e:'07:30',s:'17:18',as:'12:00',av:'13:00',sv:[{os:'1234',osc:'202601234',peso:2}],periodos_ociosos:[{inicio:'09:00',fim:'09:15'},{inicio:'15:00',fim:'15:30'}]}}],'2026-11')`);
 const html=g.$('#lista').innerHTML;
 assert.match(html,/09:00.*09:15/);assert.match(html,/15:00.*15:30/);
 assert.match(html,/483/);assert.match(html,/588/);assert.match(html,/45/);assert.match(html,/105/);
});
