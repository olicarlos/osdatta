import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {onRequest} from '../functions/api/apontamentos.ts';
import {localD1} from './d1.js';
/* Servidor de ensaio: apenas 127.0.0.1, SQLite :memory:, sem qualquer binding remoto. */
const DB=localD1(),root=fileURLToPath(new URL('../public/',import.meta.url));
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:8789');
  if(url.pathname==='/api/apontamentos'){
   const parts=[];for await(const c of req)parts.push(c);
   const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(parts)}:{})});
   /* Chave exclusivamente sintética do ensaio, não é credencial de ambiente. */
   const response=await onRequest({request,env:{DB,ADMIN_KEY:'synthetic-local-only'}});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root)){res.writeHead(403);res.end();return}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
 }catch(e){res.writeHead(500);res.end('Ensaio local: '+e.message)}
});
server.listen(8789,'127.0.0.1',()=>console.log('Ensaio sintético em http://127.0.0.1:8789; SQLite em memória; zero acesso remoto.'));
