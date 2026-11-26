import { handleGoogleAuth } from './google-auth.mjs';
import { handleRooms } from './rooms.mjs';
import { handleMigration } from './migration-store.mjs';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/site-version') return Response.json({version:'2026-11-27-portal-101'},{headers:{'Cache-Control':'no-store'}});
    if (url.pathname.startsWith('/api/migration/auth/')) return handleGoogleAuth(request, env);
    if (url.pathname === '/api/migration/rooms' || url.pathname.startsWith('/api/migration/rooms/')) {
      return handleRooms(request, env.DB, url, env);
    }
    if (url.pathname.startsWith('/api/migration/') || url.pathname.startsWith('/api/portal-rules') || url.pathname.startsWith('/api/direct-messages/')) return handleMigration(request, env);
    if (url.pathname === '/') return Response.redirect(new URL('/migration/', url), 302);
    return env.ASSETS.fetch(request);
  },
};
