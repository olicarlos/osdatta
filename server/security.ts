/* Shared API boundary. No credentials are logged or returned in errors. */
export interface SecurityEnv { ADMIN_KEY?: string; DEVICE_TOKEN_SECRET?: string }
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function boundary(request: Request, methods: string[]): Response | null {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({erro:'Origem não permitida'},403);
  if (!methods.includes(request.method)) return json({erro:'Método não permitido'},405,{Allow:methods.join(', ')});
  return null;
}
export const adminOK = (request: Request, env: SecurityEnv) => !!env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY;
export function configured(env: SecurityEnv): boolean {
  return typeof env.DEVICE_TOKEN_SECRET === 'string' && new TextEncoder().encode(env.DEVICE_TOKEN_SECRET).length >= 32;
}
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const key = (env: SecurityEnv) => crypto.subtle.importKey('raw',encoder.encode(env.DEVICE_TOKEN_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function issue(env: SecurityEnv, dispositivo: string, expires: number): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify({v:1,sub:dispositivo,exp:expires,aud:'osdatta-write'})));
  return payload+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(payload))));
}
export async function authorize(request: Request, env: SecurityEnv): Promise<string | null> {
  if (!configured(env)) return null;
  const token = request.headers.get('Authorization') || '';
  if (token.length > 2048 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const [payload,signature] = token.slice(7).split('.');
    if (!await crypto.subtle.verify('HMAC',await key(env),decode(signature),encoder.encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (claims.v !== 1 || claims.aud !== 'osdatta-write' || typeof claims.sub !== 'string' || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now()/1000)) return null;
    return claims.sub;
  } catch { return null; }
}
export class BodyError extends Error {
  status: number;
  constructor(status: number) { super('Requisição inválida'); this.status = status; }
}
export async function readJSON(request: Request, max = 1024*1024): Promise<unknown> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BodyError(415);
  const length = Number(request.headers.get('Content-Length'));
  if (length > max) { await request.body?.cancel(); throw new BodyError(413); }
  const reader = request.body?.getReader();
  if (!reader) throw new BodyError(400);
  let total=0; const chunks: Uint8Array[]=[];
  try {
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel(); throw new BodyError(413); }
      chunks.push(value);
    }
    const bytes=new Uint8Array(total);let offset=0;
    for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch (error) { if (error instanceof BodyError) throw error; throw new BodyError(400); }
  finally { reader.releaseLock(); }
}
