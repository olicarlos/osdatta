/* Synthetic authorization fixture only. Calls the actual HMAC signer and API handler. */
import {issue} from '../server/security.ts';
import {onRequest as realHandler} from '../functions/api/apontamentos.ts';
export const DEVICE_TOKEN_SECRET='synthetic-test-secret-only-0123456789abcdef';
export const tokenFor=device=>issue({DEVICE_TOKEN_SECRET},device,Math.floor(Date.now()/1000)+3600);
export const devToken=await tokenFor('dev');
export const authorizedHandler=device=>async context=>{
 const headers=new Headers(context.request.headers);
 if(context.request.method==='POST'){
  headers.set('Content-Type','application/json');headers.set('Authorization','Bearer '+await tokenFor(device));
 }
 return realHandler({...context,request:new Request(context.request,{headers}),env:{...context.env,DEVICE_TOKEN_SECRET}});
};
