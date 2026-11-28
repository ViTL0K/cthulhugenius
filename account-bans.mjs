const initialized=new WeakMap();
export async function ensureAccountBans(db){
 if(!initialized.has(db))initialized.set(db,db.prepare(`CREATE TABLE IF NOT EXISTS site_account_bans(
  user_id TEXT PRIMARY KEY REFERENCES site_users(id) ON DELETE CASCADE,
  banned_by TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
 )`).run().catch(error=>{initialized.delete(db);throw error;}));
 await initialized.get(db);
}
export async function isAccountBanned(db,userId){
 await ensureAccountBans(db);return Boolean(await db.prepare('SELECT user_id FROM site_account_bans WHERE user_id=?').bind(userId).first());
}
export async function assertAccountActive(db,userId){
 if(await isAccountBanned(db,userId))throw Object.assign(Error('Акаунт заблоковано адміністратором.'),{status:403,code:'ACCOUNT_BANNED'});
}
