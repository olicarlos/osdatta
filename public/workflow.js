import {clone,canonicalDay,validateDay,confirmar,aprovado,assinatura,dataValida} from './domain.js';
/* apt contém somente histórico salvo. apt_drafts nunca é fonte do sincronizador. */
export class Workflow {
 constructor(storage){
  this.storage=storage;
  this.read=(k,f)=>{try{const v=JSON.parse(storage.getItem(k)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:f}catch{return f}};
  this.saved=this.read('apt',{});this.saved.dias=this.saved.dias||{};
  this.drafts=this.read('apt_drafts',{});this.pending=this.read('apt_pend',{});
  const journal=this.read('apt_commit',null);
  if(journal?.key&&journal?.payload)this.apply(journal.key,journal.payload);
 }
 write(k,v){this.storage.setItem(k,JSON.stringify(v));}
 edit(k,d){
  const x=clone(d);x.revisao=(Number(this.drafts[k]?.revisao||this.saved.dias[k]?.revisao)||0)+1;x.ok=false;delete x.confirmacao;
  this.drafts[k]=x;this.write('apt_drafts',this.drafts);return x;
 }
 get(k){return this.drafts[k]||this.saved.dias[k]||{sit:'T',e:'',as:'',av:'',s:'',sv:[],periodos_ociosos:[],ok:false};}
 review(k,funcao){
  const pos=k.indexOf('|'),data=k.slice(pos+1),d=canonicalDay(this.get(k));
  const er=validateDay(d);if(!dataValida(data))er.push('Data inválida.');
  if(er.length)throw new Error(er.join(' '));
  return {dispositivo:k.slice(0,pos),funcao,data,dia:confirmar(d)};
 }
 approve(k,payload){
  /* Uma revisão aberta deixa de valer após QUALQUER edição, inclusive remoção/desfazer. */
  const current=this.review(k,payload.funcao);
  if(JSON.stringify(current)!==JSON.stringify(payload))throw new Error('Rascunho mudou. Revise novamente.');
  this.write('apt_commit',{key:k,payload});this.apply(k,payload);
 }
 apply(k,payload){
  this.saved.dias[k]=clone(payload.dia);this.write('apt',this.saved);
  this.pending[k]={payload:clone(payload),attempts:0,nextAt:0,error:''};this.write('apt_pend',this.pending);
  delete this.drafts[k];this.write('apt_drafts',this.drafts);this.storage.removeItem('apt_commit');
 }
 cancel(k){delete this.drafts[k];this.write('apt_drafts',this.drafts);}
 eligible(k,now=Date.now()){
  const q=this.pending[k],p=q?.payload;
  return !!p&&p.dispositivo+'|'+p.data===k&&validateDay(p.dia).length===0&&aprovado(p.dia)&&q.attempts<8&&q.nextAt<=now;
 }
 ack(k,payload){
  if(JSON.stringify(this.pending[k]?.payload)===JSON.stringify(payload)){
   delete this.pending[k];this.write('apt_pend',this.pending);
  }
 }
 fail(k,payload,status,retryAfter=0,now=Date.now(),random=Math.random){
  const q=this.pending[k];if(!q||JSON.stringify(q.payload)!==JSON.stringify(payload))return;
  q.attempts++;
  const transient=!status||status===408||status===429||status>=500;
  if(!transient)q.attempts=8;
  q.error=transient?'Falha temporária; snapshot aprovado preservado.':'Envio bloqueado; revise o dia antes de reenviar.';
  q.nextAt=now+Math.max(retryAfter,Math.min(300000,1000*2**q.attempts)*(0.5+random()/2));
  this.write('apt_pend',this.pending);
 }
}
