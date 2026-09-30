// 로컬 Supabase 접속 정보로 .env.local 을 만든다.
// 휴대폰(Expo Go)에서도 접속되도록 127.0.0.1 대신 이 컴퓨터의 LAN IP 를 쓴다.
// 사용: npm run db:start && npm run env:local
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

const lanIp =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';

const url = status.API_URL.replace('127.0.0.1', lanIp);

writeFileSync(
  '.env.local',
  `# npm run env:local 로 생성됨 (로컬 Supabase). 와이파이가 바뀌어 IP 가 달라지면 다시 실행하세요.
# 운영 Supabase 로 바꿀 때는 대시보드의 URL / anon(publishable) 키로 교체
EXPO_PUBLIC_SUPABASE_URL=${url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}
`,
);
console.log(`.env.local 작성 완료 → ${url}`);
