/* Contrato único do app, API D1 e conferência. Sem acesso a rede ou storage. */
export const FERIADOS=["2026-01-01","2026-04-03","2026-04-21","2026-05-01","2026-06-04","2026-07-27","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25"];
export const JORNADA=528;
export const minutos=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
export function dataValida(dt){
 if(typeof dt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dt))return false;
 const d=new Date(dt+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===dt;
}
export const especial=dt=>[0,6].includes(new Date(dt+'T12:00:00Z').getUTCDay())||FERIADOS.includes(dt);
export const clone=x=>JSON.parse(JSON.stringify(x));
export function assinatura(d){const x=clone(d);delete x.confirmacao;return JSON.stringify(x);}
export function confirmar(d){
 const x=canonicalDay(d);x.ok=true;delete x.confirmacao;
 x.confirmacao={versao:1,snapshot:assinatura(x),oss:x.sv.map(({os,osc})=>({os,osc}))};return x;
}
export function aprovado(d){
 return !!d?.confirmacao&&d.confirmacao.versao===1&&d.confirmacao.snapshot===assinatura(d)&&JSON.stringify(d.confirmacao.oss)===JSON.stringify(d.sv.map(({os,osc})=>({os,osc})));
}
export function periodos(d){return d?.periodos_ociosos===undefined?[]:d.periodos_ociosos;}
export function validateDay(d){
 const er=[];
 if(!d||typeof d!=='object'||Array.isArray(d))return ['Dia inválido.'];
 if(!['T','A','F','O'].includes(d.sit))er.push('Tipo de dia inválido.');
 if(!Array.isArray(d.sv)||d.sv.length>200)er.push('Lista de serviços inválida (máximo 200).');
 else if(d.sv.some(x=>!x||!/^\d{4}$/.test(x.os)||!/^\d{9}$/.test(x.osc)||!x.osc.endsWith(x.os)||![1,2,3].includes(x.peso)))er.push('OS deve ter número completo, sufixo de 4 dígitos e peso 1, 2 ou 3.');
 if(d.sit==='T'&&Array.isArray(d.sv)&&!d.sv.length)er.push('Adicione pelo menos um serviço.');
 const ps=periodos(d);
 if(!Array.isArray(ps)||ps.length>100)return [...er,'Períodos ociosos devem ser uma lista (máximo 100).'];
 const temHora=['e','s','as','av'].some(k=>d[k]);
 if(!['T','O'].includes(d.sit)&&!temHora&&!ps.length)return er;
 const e=minutos(d.e),s=minutos(d.s),a=minutos(d.as),v=minutos(d.av);
 if(e===null||s===null||s<=e)er.push('Informe entrada e saída válidas; a entrada deve ser anterior à saída.');
 const lunch=Boolean(d.as||d.av);
 if(lunch&&(a===null||v===null||v<=a||e===null||s===null||a<e||v>s))er.push('Almoço deve ter saída e volta válidas, em ordem, dentro da jornada.');
 const lista=[];
 for(const p of ps){
  const i=minutos(p?.inicio),f=minutos(p?.fim);
  if(i===null||f===null||i>=f){er.push('Período ocioso: início deve ser anterior ao fim em HH:mm.');continue;}
  if(e===null||s===null||i<e||f>s)er.push('Período ocioso deve estar dentro da entrada e saída.');
  if(lunch&&a!==null&&v!==null&&i<v&&f>a)er.push('Ociosidade não pode sobrepor o almoço: o almoço já é descontado.');
  lista.push([i,f]);
 }
 lista.sort((a,b)=>a[0]-b[0]);
 if(lista.some((p,i)=>i&&p[0]<lista[i-1][1]))er.push('Períodos ociosos não podem se sobrepor; limites adjacentes são permitidos.');
 return [...new Set(er)];
}
/* Dia O normaliza a lista para toda a jornada útil; nunca apaga OS ou horários. */
export function canonicalDay(input){
 const d=clone(input);
 if(d.periodos_ociosos===undefined)d.periodos_ociosos=[];
 if(d.sit==='O'){
  const e=minutos(d.e),s=minutos(d.s),a=minutos(d.as),v=minutos(d.av);
  if(e!==null&&s!==null&&s>e&&(!d.as&&!d.av||a!==null&&v!==null&&v>a&&a>=e&&v<=s)){
   d.periodos_ociosos=d.as?[{inicio:d.e,fim:d.as},{inicio:d.av,fim:d.s}].filter(p=>p.inicio!==p.fim):[{inicio:d.e,fim:d.s}];
  }
 }
 return d;
}
export function calcDay(d,dt){
 const z={bruto:0,almoco:0,ocioso:0,descontado:0,tot:0,n:0,h50:0,h100:0};
 if(!d||!['T','O'].includes(d.sit)||validateDay(d).length)return z;
 const bruto=minutos(d.s)-minutos(d.e),almoco=d.as?minutos(d.av)-minutos(d.as):0;
 const ocioso=periodos(d).reduce((sum,p)=>sum+minutos(p.fim)-minutos(p.inicio),0);
 const tot=d.sit==='O'?0:Math.max(0,bruto-almoco-ocioso);
 return {bruto,almoco,ocioso,descontado:almoco+ocioso,tot,n:especial(dt)?0:Math.min(tot,JORNADA),h50:especial(dt)?0:Math.max(0,tot-JORNADA),h100:especial(dt)?tot:0};
}
