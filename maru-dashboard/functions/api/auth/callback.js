import { createSession, parseCookies, cookieHeader } from '../../_utils.js';

// GET /api/auth/callback?code=...&state=...
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(request);

  if (!code || !state || state !== cookies.oauth_state) {
    return Response.redirect(`${url.origin}/?error=state`, 302);
  }

  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  // 1. code -> access token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) return Response.redirect(`${url.origin}/?error=token`, 302);
  const token = await tokenRes.json();

  // 2. 유저 정보 + 길드 목록
  const [meRes, guildsRes] = await Promise.all([
    fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
    fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
  ]);
  if (!meRes.ok || !guildsRes.ok) return Response.redirect(`${url.origin}/?error=fetch`, 302);

  const me = await meRes.json();
  const guilds = await guildsRes.json();

  // 관리자(MANAGE_GUILD=0x20) 권한 있는 서버만
  const MANAGE_GUILD = 0x20;
  const managed = guilds
    .filter(g => g.owner || (BigInt(g.permissions) & BigInt(MANAGE_GUILD)) === BigInt(MANAGE_GUILD))
    .map(g => ({ id: g.id, name: g.name, icon: g.icon }));

  // 3. 세션 쿠키 발급 (7일)
  const session = await createSession(env.SESSION_SECRET, {
    user: { id: me.id, username: me.global_name || me.username, avatar: me.avatar },
    guilds: managed,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/`,
      'Set-Cookie': cookieHeader('session', session, 7 * 24 * 60 * 60),
    },
  });
}
