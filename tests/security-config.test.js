import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('Netlify legado não oferece caminho alternativo de gravação',async()=>{
 const {default:legacy}=await import('../netlify/functions/apontamentos.ts');
 const r=await legacy(new Request('https://legacy.test/api/apontamentos',{method:'POST'}));
 assert.equal(r.status,410);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('CSP usa hashes reais e proíbe handlers inline e eval',()=>{
 const headers=readFileSync('public/_headers','utf8');assert.ok(!headers.includes('unsafe-eval'));assert.match(headers,/script-src-attr 'none'/);
 for(const file of ['public/index.html','public/conferencia.html']){
  const html=readFileSync(file,'utf8');assert.doesNotMatch(html,/\son(?:click|change|focus|error)\s*=/i);
  for(const [,script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.ok(headers.includes(createHash('sha256').update(script).digest('base64')));
 }
});
