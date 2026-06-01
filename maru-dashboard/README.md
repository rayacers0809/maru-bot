# 마루 대시보드 (Cloudflare Pages)

마루 봇 설정을 웹에서 관리하는 대시보드. Discord 로그인 → 서버 선택 → 음성로그/환영/필터 토글.

## 구조
```
대시보드(이 폴더, Cloudflare Pages) ──HTTP──> 봇 설정 API(Oracle VPS) ──> Firestore
       │
       └ Discord OAuth2 (로그인/유저/관리서버 목록)
```
- 프론트: `public/` (정적)
- 백엔드: `functions/` (Cloudflare Pages Functions)
- 설정 저장은 봇이 직접 Firestore에 함 → 서비스계정 키를 Cloudflare에 안 올려도 됨

---

## 1. Discord 앱 설정
개발자 포털 > 내 앱 > OAuth2:
- **Redirect** 추가: `https://<대시보드도메인>/api/auth/callback`
- Client ID / Client Secret 복사

## 2. Cloudflare Pages 배포
1. 이 폴더를 GitHub에 푸시 → Cloudflare Pages에서 연결
   - **Build command**: 없음 (정적)
   - **Build output directory**: `public`
2. **Settings > Environment variables** 에 추가:
   | 변수 | 값 |
   |---|---|
   | `DISCORD_CLIENT_ID` | Discord 앱 Client ID |
   | `DISCORD_CLIENT_SECRET` | Discord 앱 Client Secret |
   | `DISCORD_REDIRECT_URI` | `https://<도메인>/api/auth/callback` |
   | `SESSION_SECRET` | 랜덤 긴 문자열 (예: `openssl rand -hex 32`) |
   | `BOT_API_URL` | 봇 API 주소 (예: `http://<오라클IP>:8080`) |
   | `DASHBOARD_API_SECRET` | 봇 `.env`의 같은 값과 일치 |

## 3. 봇 쪽 준비 (Oracle VPS)
봇 `.env` 에 동일하게:
```
DASHBOARD_API_SECRET=<위와 같은 값>
API_PORT=8080
FIREBASE_SERVICE_ACCOUNT={...}   # 또는 serviceAccountKey.json
```
봇을 `npm start` 하면 8080 포트로 설정 API가 함께 열림.
오라클 방화벽(보안목록 + iptables)에서 **8080 포트 인바운드 허용** 필요.

> ⚠️ 보안: `BOT_API_URL`을 HTTP로 노출하면 시크릿이 평문 전송돼요.
> 가능하면 봇 앞에 Cloudflare Tunnel이나 Nginx+HTTPS를 두는 걸 권장.

## 로컬 테스트
```bash
npm i -g wrangler
wrangler pages dev public
```
(환경변수는 `.dev.vars` 파일에 넣으면 됨)

---

## 흐름
1. `/api/auth/login` → Discord 인증
2. `/api/auth/callback` → 토큰 교환, 관리권한 있는 서버만 추려서 서명 쿠키 발급
3. `/api/me` → 세션 유저/서버 목록
4. `/api/guild/:id` → 봇 API로 설정 읽기/쓰기 (세션+관리권한 이중 확인)
