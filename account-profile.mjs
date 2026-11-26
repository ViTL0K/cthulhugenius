export async function ensureAccountProfiles(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS account_profiles (user_id TEXT PRIMARY KEY REFERENCES site_users(id) ON DELETE CASCADE, display_name TEXT NOT NULL)').run();
}
export async function saveAccountName(db,userId,value) {
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/u.test(value))throw Object.assign(new Error('Вкажи ім’я без службових символів.'),{status:400});
  const name=value.trim().replace(/\s+/gu,' ');
  if(!name||Array.from(name).length>24)throw Object.assign(new Error('Ім’я має містити від 1 до 24 символів.'),{status:400});
  await ensureAccountProfiles(db);
  await db.batch([
    db.prepare('INSERT INTO account_profiles(user_id,display_name) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name').bind(userId,name),
    db.prepare('UPDATE site_users SET display_name=? WHERE id=?').bind(name,userId),
    db.prepare('UPDATE game_members SET display_name=? WHERE user_id=?').bind(name,userId)
  ]);
  return name;
}
