import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as domain from '../public/domain.js';
import {Workflow} from '../public/workflow.js';
export function app(storageData={}){
 const store=new Map(Object.entries({apt_dev:'dev',apt_f:'Oficial de Manutenção',apt_sync:'1',...storageData}));
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const elements=new Map();
 const element=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){}},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(s)};
 const context={...domain,Workflow,console,localStorage,document:{querySelector:element},location:{protocol:'https:'},navigator:{onLine:false},setTimeout:()=>1,clearTimeout(){},addEventListener(){},scrollTo(){},crypto:{randomUUID:()=> 'test-uuid'},Date,JSON,AbortSignal,alert(){},fetch:async()=>{throw Error('offline')}};
 context.window=context;
 vm.createContext(context);
 const source=readFileSync(new URL('../public/index.html',import.meta.url),'utf8').match(/<script(?: type="module")?>([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/gm,'');
 vm.runInContext(source,context);
 return {context,store,element,run:code=>vm.runInContext(code,context)};
}
