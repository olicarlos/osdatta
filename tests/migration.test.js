import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {migration} from './d1.js';
test('ALTER ADD preserva todos os bytes das colunas legadas e default []',()=>{
 const db=new DatabaseSync(':memory:');db.exec(migration('0001_create_apontamentos.sql'));
 const legacy=JSON.stringify({sit:'T',e:'08:00',s:'17:48',as:'12:00',av:'13:00',sv:[{os:'9999',osc:'202609999',peso:3}],ok:true});
 db.prepare('INSERT INTO apontamentos (dispositivo,pessoa,funcao,data,dia) VALUES (?,?,?,?,?)').run('fixture','sintético','teste','2026-11-03',legacy);
 const before=db.prepare('SELECT * FROM apontamentos').get();
 db.exec(migration('0002_periodos_ociosos.sql'));
 const after=db.prepare('SELECT * FROM apontamentos').get();
 assert.equal(after.periodos_ociosos,'[]');delete after.periodos_ociosos;assert.deepEqual(after,before);
 for(const bad of ['null','{}','broken'])assert.throws(()=>db.prepare('UPDATE apontamentos SET periodos_ociosos=?').run(bad));
 assert.throws(()=>db.prepare('UPDATE apontamentos SET periodos_ociosos=NULL').run());
 assert.equal(db.prepare('SELECT dia FROM apontamentos').get().dia,legacy);
 db.close();
});
