import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hashes=['public/index.html','public/conferencia.html'].flatMap(file=>[...readFileSync(file,'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(([,script])=>"'sha256-"+createHash('sha256').update(script).digest('base64')+"'"));
writeFileSync('public/_headers',`/*
  Content-Security-Policy: default-src 'self'; script-src 'self' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/conferencia.html
  Cache-Control: no-store
/sw.js
  Cache-Control: no-cache
`);
