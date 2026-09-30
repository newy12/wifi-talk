# 📶 WiFi Graffiti

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

## 🗺️ 장소는 어떻게 정하나? (SSID 제한 대응)

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
│       └── 20261001000100_moderation.sql  # 신고, 금칙어, 개인정보 필터
├── docs/
│   └── PERMISSIONS.md        # Android/iOS 권한 & 스토어 제출 가이드
└── src/
    ├── app/                  # Expo Router 화면 (파일 = 라우트)
    │   ├── _layout.tsx
    │   ├── index.tsx         # 장소 선택 (SSID 감지 + 수동 태그 + 동의)
    │   ├── board/[tag].tsx   # 메인 보드: 실시간 조회 + 작성 + 신고/차단
    │   └── about.tsx         # 운영정책 · 개인정보처리방침
    ├── components/           # Chip, Composer, PostItem, PostActionSheet, SetupNotice
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
