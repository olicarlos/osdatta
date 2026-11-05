import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let failures=0;
function check(args,input){
 const r=spawnSync(process.execPath,args,{cwd:root,input,encoding:'utf8'});
 console.log(`node ${args.join(' ')}: exit ${r.status}`);
 if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
 if(r.status!==0)failures++;
}
for(const name of readdirSync(new URL('../public/',import.meta.url))){
 if(name.endsWith('.js'))check(['--check','public/'+name]);
 if(name.endsWith('.html')){
  const html=readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
  for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   console.log('Sintaxe inline real: public/'+name);check(['--check','--input-type=module'],script[1]);
  }
 }
}
const compiler=process.env.TSC_PATH||'node_modules/typescript/bin/tsc';
check([compiler,'--noEmit','--allowImportingTsExtensions','--strict','--target','es2022','--module','es2022','--moduleResolution','bundler','--skipLibCheck','--lib','es2022,dom','functions/api/apontamentos.ts','functions/api/device-token.ts','netlify/functions/apontamentos.ts']);
process.exitCode=failures?1:0;
