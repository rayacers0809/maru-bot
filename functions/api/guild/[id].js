import { verifySession, parseCookies, json } from '../../_utils.js';

// GET  /api/guild/:id  -> 봇 API에서 설정+채널 가져오기
// POST /api/guild/:id  -> 봇 API로 설정 저장
export async function onRequest(context) {
  const { env, request, params } = context;
  const guildId = params.id;

  // 세션 검증
  const cookies = parseCookies(request);
  const session = await verifySession(env.SESSION_SECRET, cookies.session);
  if (!session) return json({ error: 'unauthorized' }, 401);

  // 이 유저가 해당 길드 관리 권한을 가졌는지 확인
  const allowed = session.guilds.some(g => g.id === guildId);
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const botUrl = `${env.BOT_API_URL}/api/guild/${guildId}`;
  const headers = { 'X-Api-Secret': env.DASHBOARD_API_SECRET };

  try {
    if (request.method === 'GET') {
      const res = await fetch(botUrl, { headers });
      const data = await res.json();
      return json(data, res.status);
    }
    if (request.method === 'POST') {
      const body = await request.text();
      const res = await fetch(botUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      return json(data, res.status);
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: '봇 API에 연결할 수 없습니다. 봇이 켜져 있는지 확인하세요.' }, 502);
  }
}
