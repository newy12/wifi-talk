# 🧱 담벼락

같은 장소에 있는 사람들끼리 **익명 낙서**를 남기는 앱. 글은 **24시간 뒤 자동으로 사라집니다.**
**웹 서비스로 먼저 시작**하고, 같은 코드로 Android · iOS 앱까지 확장할 수 있습니다. **초기 자본과 서버비 0원**으로 운영합니다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | **Expo (React Native) SDK 57 + TypeScript + Expo Router** | 1인 개발에 가장 빠름. Web까지 같은 코드로 동작, Expo Go로 즉시 실행, EAS로 Xcode 없이 클라우드 빌드 |
| 백엔드 | **Supabase 무료 플랜** | Postgres + Realtime + RLS. 별도 서버 코드 없음 |
| 데이터 수명 | 24시간 TTL + 보드당 최신 100개 + pg_cron 정리 | DB 용량 상한이 고정되어 무료 한도(500MB)를 넘지 않음 |

---

## 🌐 웹 서비스 우선

지금은 **웹 서비스로 먼저 운영**합니다. 앱 설치 없이 링크 하나로 들어오므로 초기 사용자 확보가 쉽고, 스토어 심사·계정 비용이 없습니다.
같은 코드로 나중에 Android/iOS 앱도 빌드할 수 있습니다 ([docs/PERMISSIONS.md](docs/PERMISSIONS.md)).

웹에서 달라지는 점:
- 브라우저는 와이파이 이름(SSID)을 읽을 수 없어서, **장소 태그 직접 입력 + 공유 링크**로 입장합니다.
- 보드 화면의 **링크 공유** 버튼 → `https://<도메인>/board/카페 스타벅스` 같은 링크가 만들어집니다. 매장 테이블에 이 링크의 QR 코드를 붙이면 SSID 자동 감지를 대신할 수 있습니다.
- 링크로 처음 들어온 사람은 운영정책에 동의한 뒤 **원래 보드로 바로 이동**합니다.
- 모바일 브라우저에서 "홈 화면에 추가"하면 앱처럼 전체 화면으로 열립니다 (`public/manifest.json`).

## 🚀 개발 서버 실행

```bash
npm install
npm run dev          # w 를 누르면 브라우저에서 열림 (http://localhost:8081)
```

`.env.local`은 현재 **운영 Supabase**를 가리킵니다. 로컬 DB로 개발하려면 (Docker Desktop 필요):

```bash
npm run db:start && npm run env:local && npm run dev
```

| 명령 | 설명 |
|---|---|
| `npm run build:web` | 배포용 정적 파일을 `dist/`에 생성 |
| `npm run preview:web` | `dist/`를 실제 배포와 같은 방식으로 띄워 확인 (http://localhost:3000) |
| `npm run db:push` | `supabase/migrations/`의 새 마이그레이션을 운영 DB에 적용 |
| `npm run db:start` / `db:stop` / `db:reset` | 로컬 Supabase |
| `npm run typecheck` / `npm run lint` | 타입 검사 / 린트 |

## ☁️ 웹 배포 (무료)

빌드 결과(`dist/`)는 정적 파일이라 무료 호스팅 어디에나 올릴 수 있습니다.
`/board/...` 주소로 바로 들어와도 열리도록 SPA 설정이 들어 있습니다 (`wrangler.jsonc`, `vercel.json`).

| 호스팅 | 방법 | 무료 한도 |
|---|---|---|
| **Cloudflare Workers** (현재 사용 중) | `npm run deploy:web` (빌드 + 배포) | 정적 파일 요청 무제한 |
| Vercel | GitHub 저장소 연결 (설정은 `vercel.json`이 자동 적용) | 월 100GB |

**환경 변수 주의**: `EXPO_PUBLIC_*` 값은 **빌드할 때** 코드에 들어갑니다. 내 컴퓨터에서 빌드해 올리면 `.env.local`이 쓰이고, Vercel처럼 호스팅에서 빌드하면 그 대시보드에 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 등록해야 합니다.

운영 Supabase: 프로젝트 `wiki-project` (ref `rwxfbdfjfpyzzqjxuvpn`, 싱가포르 리전). **7일 동안 요청이 없으면 일시정지**되니, 대시보드에서 Restore를 누르면 됩니다.

---

## 📶 같은 와이파이 보드 (`/wifi`)

같은 공유기에 연결된 기기들은 인터넷에 나갈 때 **같은 공인 IP**를 씁니다. 서버가 요청의 IP로 보드를 정해서, 같은 와이파이 사람끼리만 묶습니다. 사용자는 아무것도 입력하지 않습니다.

- 보드 키 = `wifi-` + HMAC(서버 비밀키, 네트워크 ‖ ISO 주차). IPv4는 주소, IPv6는 /64 대역 기준. **IP 원본은 저장하지 않고**, 키는 매주 바뀜
- IP는 Supabase 앞단 Cloudflare가 넣는 `cf-connecting-ip`를 사용. 클라이언트가 위조하면 Cloudflare가 403으로 거부
- 쓰기·REST 읽기는 지금 그 네트워크에 있는 사람만 (트리거 + RLS). Realtime은 추측 불가능한 키로 보호
- 와이파이가 바뀌면 1분 안에(앱 복귀·재연결 시 즉시) 새 네트워크의 보드로 자동 이동
- 휴대폰 데이터(LTE/5G)는 통신사가 여러 사람에게 같은 IP를 줘서 섞이므로 차단. 세 단계로 확인:
    1. 기기가 알려주는 경우 (Android Chrome, 앱) → 즉시 차단
    2. **서버가 IP로 확인**: 국내 이동통신 3사 데이터망 대역(`private.mobile_networks`)이면 보드 키를 주지 않음 → iOS에서 "와이파이예요"를 눌러도 막힘. 쓰기·읽기도 서버에서 거부
    3. 그래도 모르는 경우(목록에 없는 해외 통신사·일부 알뜰폰) 대비로, 기기가 알려주지 않으면 입장 전에 "와이파이에 연결되어 있나요?"를 한 번 물어봄
- 데이터망 대역 목록 출처: [위키백과:이동통신사 IP 주소](https://ko.wikipedia.org/wiki/%EC%9C%84%ED%82%A4%EB%B0%B1%EA%B3%BC:%ED%86%B5%EC%8B%A0%EC%82%AC_IP) + RIPEstat 라우팅·WHOIS 교차 확인 (2026-10). 통신사가 대역을 바꾸면 `insert into private.mobile_networks ...` 로 추가
- 데이터 연결일 때는 첫 화면의 "지금 글 N개"를 숨김 (통신사 IP 기준 숫자라 의미 없음)
- 한계: 출구 IP가 여러 개인 대형 네트워크(대학교 등)는 보드가 나뉠 수 있고, VPN 사용자는 VPN 서버 기준으로 묶임 → 이런 곳은 장소 태그 보드 사용

구현: `supabase/migrations/20261001000200_wifi_boards.sql`, `src/app/wifi.tsx`, `src/lib/network.ts`

## 👀 접속자 수

Supabase Realtime **Presence**로 첫 화면에 "지금 N명 접속 중", 보드에 "N명 보는 중"을 보여줍니다 (`src/hooks/usePresence.tsx`).
기기의 익명 태그 기준이라 같은 기기의 탭 여러 개는 1명으로 셉니다. 서버에 저장하지 않고, 글 구독과 같은 웹소켓을 공유하므로 동시 접속 한도를 추가로 쓰지 않습니다.

## 🗺️ 장소 태그 보드 (SSID 제한 대응)

모바일 OS는 개인정보 보호 때문에 와이파이 이름(SSID) 접근을 강하게 막습니다 (위치 권한 + iOS 전용 엔타이틀먼트 필요, 웹은 불가능).
그래서 **와이파이 자동 감지는 보조 수단**이고, 기본 흐름은 **사용자가 장소 태그를 직접 정하는 것**입니다.

1. **📶 와이파이 이름으로 찾기**: 가능한 기기에서만 SSID를 읽어서 입력칸에 채워줌. 사용자가 수정 가능
   - `iptime`, `KT_GiGA…`처럼 흔한 공유기 이름이면 "다른 곳과 섞일 수 있다"고 경고함
2. **카테고리 칩 + 직접 입력**: `카페` + `스타벅스 강남역점` → `#카페 스타벅스 강남역점`
3. **최근 장소**: 기기에만 저장됨
4. **지금 활발한 보드**: 글이 살아있는 보드를 서버에서 추천

태그는 정규화(소문자, 공백 정리, 특수문자 제거)되어서 `스타벅스  강남역점`과 `스타벅스 강남역점`은 같은 보드가 됩니다.

권한 설정은 **[docs/PERMISSIONS.md](docs/PERMISSIONS.md)** 에 정리되어 있습니다.

---

## 💸 서버비 0원 설계

```
글 작성 ─▶ [BEFORE INSERT 트리거]
             · created_at / expires_at / report_count 서버 강제 (클라이언트 값 무시)
             · 같은 익명태그 10초 1회, 보드당 1분 30회 제한
             · 금칙어(띄어쓰기·특수문자 우회 포함) / 전화번호 차단
         ─▶ [AFTER INSERT 트리거] 보드당 최신 100개 초과분 즉시 삭제
조회     ─▶ [RLS] 만료 전 + 신고 3건 미만 글만 보임
정리     ─▶ [pg_cron] 10분마다 만료 글 물리 삭제 (신고 기록도 함께 삭제)
         ─▶ [pg_cron] 매일 04:00(KST) 7일 지난 cron 실행 기록 삭제
```

- 익명(anon) 역할은 글 `SELECT`·`INSERT`와 `report_post()` 호출만 가능 (수정·삭제·신고내역 조회 불가)
- 로그인·세션 없음 → Auth 사용자 행이 쌓이지 않음
- Realtime은 보드별 `INSERT`만 구독 → 무료 한도(동시 접속 200, 월 200만 메시지) 안에서 넉넉함

## 🛡️ 운영(모더레이션) — 스토어 UGC 정책 대응

| 기능 | 위치 |
|---|---|
| 첫 입장 시 운영정책·개인정보처리방침 동의 (딥링크로 들어와도 적용) | `src/hooks/useConsent.ts` |
| 글 ⋯ 메뉴 → 신고 (사유 5종). 서로 다른 3명이 신고하면 모두에게서 자동 숨김 | `report_post()`, `PostActionSheet.tsx` |
| 작성자 차단 (그 익명 태그의 글을 모든 보드에서 숨김, 기기 로컬) | `useHiddenContent.ts` |
| 금칙어 필터 — 운영 중 추가: `insert into banned_words (word) values ('단어');` | `20261001000100_moderation.sql` |
| 전화번호 게시 차단 | 동일 |
| 운영정책 / 개인정보처리방침 / 차단 해제 화면 | `src/app/about.tsx` (웹 `/about`, 스토어 제출 시 방침 URL로 사용) |

신고 내역 확인: Supabase Studio → `reports` 테이블, 또는
```sql
select p.board_key, p.body, p.report_count, array_agg(r.reason)
from posts p join reports r on r.post_id = p.id
group by p.id order by p.report_count desc;
```

---

## 📁 폴더 구조

```
wifi-talk/
├── app.json                  # Expo 설정 (권한, 엔타이틀먼트, 플러그인)
├── eas.json                  # EAS Build 프로필 (앱 출시 때 사용)
├── vercel.json               # Vercel 배포 설정 (SPA 라우팅)
├── wrangler.jsonc            # Cloudflare Workers 배포 설정 (현재 운영)
├── public/                   # 웹 전용: index.html(메타/OG), manifest.json(PWA), 아이콘
├── .env.example              # Supabase 환경변수 템플릿
├── scripts/local-env.mjs     # 로컬 Supabase → .env.local 생성
├── supabase/
│   ├── config.toml           # 로컬 Supabase 설정 (supabase start)
│   └── migrations/
│       ├── 20261001000000_init.sql        # 테이블, RLS, TTL, 도배 제한, Realtime, pg_cron
│       ├── 20261001000100_moderation.sql  # 신고, 금칙어, 개인정보 필터
│       ├── 20261001000200_wifi_boards.sql # 같은 와이파이 보드 (IP 해시, 네트워크 검증)
│       ├── 20261001000300_block_mobile_networks.sql # 이동통신 데이터망 IP 차단
│       └── 20261001000400_purge_cron_history.sql    # cron 실행 기록 정리
├── docs/
│   └── PERMISSIONS.md        # Android/iOS 권한 & 스토어 제출 가이드
└── src/
    ├── app/                  # Expo Router 화면 (파일 = 라우트)
    │   ├── _layout.tsx
    │   ├── index.tsx         # 장소 선택 (SSID 감지 + 수동 태그 + 동의)
    │   ├── wifi.tsx          # 같은 와이파이 보드 (네트워크 자동 감지·전환)
    │   ├── board/[tag].tsx   # 장소 태그 보드
    │   └── about.tsx         # 운영정책 · 개인정보처리방침
    ├── components/           # BoardView(보드 공통 화면), Chip, Composer, PostItem, PostActionSheet, SetupNotice
    ├── hooks/                # useBoardPosts, useActiveBoards, useRecentTags, useHiddenContent, useConsent
    └── lib/                  # supabase 클라이언트, 태그 정규화, SSID 감지, 링크 공유, 익명 ID, 설정값
```

---

## 남은 일

웹 오픈 전:
- [ ] `src/lib/config.ts`의 `CONTACT_EMAIL`을 실제 운영자 연락처로 교체
- [ ] 아이콘 / OG 이미지 (`assets/icon.png`, `public/icon-*.png`)
- [ ] 웹 호스팅 배포 + (선택) 도메인 연결

나중에 앱으로 확장할 때:
- [ ] `app.json`의 `bundleIdentifier` / `package`를 본인 도메인으로 교체 (스토어 등록 후에는 변경 불가)
- [ ] 스토어 계정: Google Play $25(1회), Apple $99/년
- [ ] 좌표를 대략적인 격자(geohash)로 바꿔 "근처 보드" 추천 (좌표 원본은 저장하지 않음)
