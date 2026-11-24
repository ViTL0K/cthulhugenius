import { handleGoogleAuth } from './google-auth.mjs';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/migration/auth/')) return handleGoogleAuth(request, env);
    if (url.pathname === '/') return Response.redirect(new URL('/migration/', url), 302);
    return env.ASSETS.fetch(request);
  },
};
