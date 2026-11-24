const callbackPath = '/api/migration/auth/google/callback';
const landingPath = '/migration/';
const flowCookie = '__Host-poklik-oauth';
const sessionCookie = '__Host-poklik-session';
const sessionSeconds = 7 * 24 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function digest(value) {
  return base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function cookie(name, value, maxAge) {
  return name + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=' + maxAge;
}

function getCookie(request, name) {
  const prefix = name + '=';
  return request.headers.get('Cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(prefix))?.slice(prefix.length);
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ ...noStore, Location: location });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

function failedSignIn(reason) {
  return redirect(landingPath + '?signin=' + reason, [cookie(flowCookie, '', 0)]);
}

async function startSignIn(env) {
  const state = randomToken();
  const verifier = randomToken();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await digest(verifier),
    code_challenge_method: 'S256',
  });
  return redirect(url.href, [cookie(flowCookie, state + '.' + verifier, 600)]);
}

function diagnostic(stage) {
  return Response.json(
    { error: 'Не вдалося завершити вхід.', stage },
    { status: 503, headers: { ...noStore, 'Set-Cookie': cookie(flowCookie, '', 0) } },
  );
}

async function googleProfile(env, code, verifier, attempt) {
  attempt.stage = 'google-token';
  const exchange = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    redirect: 'manual',
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!exchange.ok) {
    const result = await exchange.json().catch(() => null);
    const knownErrors = ['invalid_client', 'invalid_grant', 'unauthorized_client', 'redirect_uri_mismatch'];
    attempt.stage += '-' + exchange.status;
    if (knownErrors.includes(result?.error)) attempt.stage += '-' + result.error;
    return null;
  }
  const token = (await exchange.json()).access_token;
  if (typeof token !== 'string' || !token) return null;

  attempt.stage = 'google-profile';
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    redirect: 'error',
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) {
    attempt.stage += '-' + response.status;
    return null;
  }
  const profile = await response.json();
  if (typeof profile.sub !== 'string' || !profile.sub ||
      typeof profile.email !== 'string' || !profile.email || profile.email_verified !== true) return null;
  return profile;
}

async function finishSignIn(request, env, url, attempt) {
  const [state, verifier] = getCookie(request, flowCookie)?.split('.') ?? [];
  const code = url.searchParams.get('code');
  if (!tokenPattern.test(state ?? '') || !tokenPattern.test(verifier ?? '') ||
      state !== url.searchParams.get('state')) return failedSignIn('expired');
  if (url.searchParams.has('error') || !code) return failedSignIn('cancelled');

  const profile = await googleProfile(env, code, verifier, attempt);
  if (!profile) return diagnostic(attempt.stage);
  attempt.stage = 'd1-account';
  const name = (typeof profile.name === 'string' ? profile.name.trim() : '').slice(0, 120);
  const user = await env.DB.prepare(
    'INSERT INTO site_users (id, google_subject, email, display_name) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT (google_subject) DO UPDATE SET email = excluded.email, display_name = excluded.display_name ' +
    'RETURNING id'
  ).bind(crypto.randomUUID(), profile.sub, profile.email, name || profile.email).first();

  const previousToken = getCookie(request, sessionCookie);
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const statements = [
    env.DB.prepare('INSERT INTO site_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await digest(token), user.id, now + sessionSeconds),
    env.DB.prepare('DELETE FROM site_sessions WHERE expires_at <= ?').bind(now),
  ];
  if (tokenPattern.test(previousToken ?? '')) {
    statements.push(env.DB.prepare('DELETE FROM site_sessions WHERE token_hash = ?').bind(await digest(previousToken)));
  }
  attempt.stage = 'd1-session';
  await env.DB.batch(statements);
  return redirect(landingPath, [cookie(flowCookie, '', 0), cookie(sessionCookie, token, sessionSeconds)]);
}

async function currentSession(request, db) {
  const token = getCookie(request, sessionCookie);
  if (!tokenPattern.test(token ?? '')) return json({ user: null });
  const user = await db.prepare(
    'SELECT u.id, u.display_name FROM site_sessions s JOIN site_users u ON u.id = s.user_id ' +
    'WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(await digest(token), Math.floor(Date.now() / 1000)).first();
  return json({ user });
}

async function signOut(request, db, origin) {
  if (request.headers.get('Origin') !== origin) return json({ error: 'Forbidden' }, 403);
  const token = getCookie(request, sessionCookie);
  if (tokenPattern.test(token ?? '')) {
    await db.prepare('DELETE FROM site_sessions WHERE token_hash = ?').bind(await digest(token)).run();
  }
  return redirect(landingPath, [cookie(sessionCookie, '', 0)]);
}

export async function handleGoogleAuth(request, env) {
  const url = new URL(request.url);
  const expectedRedirect = new URL(callbackPath, url.origin).href;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.DB ||
      url.protocol !== 'https:' || env.GOOGLE_REDIRECT_URI !== expectedRedirect) {
    return json({ error: 'Sign-in is unavailable' }, 503);
  }

  const attempt = { stage: 'callback' };
  try {
    if (request.method === 'GET' && url.pathname === '/api/migration/auth/google') return await startSignIn(env);
    if (request.method === 'GET' && url.pathname === callbackPath) return await finishSignIn(request, env, url, attempt);
    if (request.method === 'GET' && url.pathname === '/api/migration/auth/session') return await currentSession(request, env.DB);
    if (request.method === 'POST' && url.pathname === '/api/migration/auth/logout') return await signOut(request, env.DB, url.origin);
    return json({ error: 'Not found' }, 404);
  } catch {
    if (url.pathname === callbackPath) return diagnostic(attempt.stage);
    return json({ error: 'Sign-in is unavailable' }, 503);
  }
}
