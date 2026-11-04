import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export const migration=n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8');
/* Adaptador D1 local com SQLite real; somente memória e fixtures sintéticas. */
export function localD1(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(migration('0001_create_apontamentos.sql'));
 sqlite.exec(migration('0002_periodos_ociosos.sql'));
 return {sqlite,prepare(query){
  const stmt=sqlite.prepare(query);
  return {query,values:[],bind(...values){this.values=values;return this},
   async run(){return stmt.run(...this.values)},
   async all(){return {results:stmt.all(...this.values)}}};
 },async batch(statements){
  sqlite.exec('BEGIN');
  try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}
  catch(e){sqlite.exec('ROLLBACK');throw e}
 }};
}
