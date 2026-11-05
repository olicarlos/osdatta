import {json,boundary,adminOK,configured,issue,readJSON,BodyError} from '../../server/security.ts';
import type {SecurityEnv} from '../../server/security.ts';
/* Authorizes an existing installation identity; never creates an anonymous identity. */
export async function onRequest({request,env}: {request: Request;env: SecurityEnv}): Promise<Response> {
  const rejected=boundary(request,['POST']);if(rejected)return rejected;
  if (!adminOK(request,env)) return json({erro:'Não autorizado'},401);
  if (!configured(env)) return json({erro:'Autorização indisponível'},503);
  try {
    const body=await readJSON(request,4096) as {dispositivo?: unknown};
    if (!body || typeof body.dispositivo !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.dispositivo)) return json({erro:'UUID inválido'},400);
    const expires=Math.floor(Date.now()/1000)+90*24*60*60;
    return json({token:await issue(env,body.dispositivo,expires),expiresAt:new Date(expires*1000).toISOString()});
  } catch(error) { return json({erro:'Requisição indisponível'},error instanceof BodyError ? error.status : 503); }
}
