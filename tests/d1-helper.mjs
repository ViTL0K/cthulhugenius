import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));}
  prepare(sql){const db=this.db;const params=[];const run={bind(...p){params.splice(0,params.length,...p);return run},async first(){return db.prepare(sql).get(...params)||null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){const statement=db.prepare(sql);if(statement.columns().length)return {results:statement.all(...params),meta:{changes:0}};const r=statement.run(...params);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}}};return run;}
  async batch(statements){this.db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
