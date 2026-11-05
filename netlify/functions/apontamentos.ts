/* Legacy Netlify route retired: Cloudflare Pages is the supported backend.
   Never import the legacy DB or accept unauthenticated writes. */
export default async (_request: Request): Promise<Response> =>
  Response.json({erro:'Endpoint legado desativado'}, {status:410,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const config = { path:'/api/apontamentos' };
