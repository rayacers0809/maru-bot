import { verifySession, parseCookies, json } from '../_utils.js';

// GET /api/me -> { user, guilds }
export async function onRequest(context) {
  const { env, request } = context;
  const cookies = parseCookies(request);
  const session = await verifySession(env.SESSION_SECRET, cookies.session);
  if (!session) return json({ error: 'unauthorized' }, 401);
  return json({ user: session.user, guilds: session.guilds });
}
