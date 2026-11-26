import { handleGoogleAuth } from './google-auth.mjs';
import { handleRooms } from './rooms.mjs';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/migration/auth/')) return handleGoogleAuth(request, env);
    if (url.pathname === '/api/migration/rooms' || url.pathname.startsWith('/api/migration/rooms/')) {
      return handleRooms(request, env.DB, url);
    }
    if (url.pathname === '/') return Response.redirect(new URL('/migration/', url), 302);
    return env.ASSETS.fetch(request);
  },
};
