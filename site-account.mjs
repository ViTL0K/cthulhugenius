// Only the Google-verified account selected by the site owner can administer the site.
// Store a fingerprint, rather than publishing the owner's email in this repository.
export const ADMIN_EMAIL_SHA256 = 'e1ab0fe8adeb18e80f892e38bb3aa12c7c502d2090a5303f0e93cd95f8cd7f4a';
export async function emailFingerprint(email) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(email||'').trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function accountRole(db,userId,env={}) {
  const user=await db.prepare('SELECT email FROM site_users WHERE id=?').bind(userId).first();
  if(!user)return 'player';
  const assigned=await db.prepare('SELECT role FROM account_roles WHERE user_id=?').bind(userId).first();
  if(await emailFingerprint(user.email)===(env.ADMIN_GOOGLE_EMAIL_SHA256||ADMIN_EMAIL_SHA256)) {
    if(assigned?.role!=='admin')await db.prepare("INSERT INTO account_roles(user_id,role) VALUES(?,'admin') ON CONFLICT(user_id) DO UPDATE SET role='admin'").bind(userId).run();
    return 'admin';
  }
  // An old/manual role row cannot create a second site administrator.
  return ['keeper','admin'].includes(assigned?.role)?'keeper':'player';
}
