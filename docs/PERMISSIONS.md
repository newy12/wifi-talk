# 안드로이드 / iOS 빌드 권한 설정 가이드

WiFi Graffiti가 쓰는 OS 권한은 **"와이파이 이름(SSID)으로 장소 추천"** 기능 하나를 위한 것입니다.
이 기능은 **보조 기능**이라서 권한을 거부하거나 OS가 SSID를 숨겨도 앱은 **수동 장소 태그 입력**으로 정상 동작합니다.

> 모든 네이티브 설정은 `app.json`에 들어 있습니다. `ios/`, `android/` 폴더는 빌드할 때 자동 생성(CNG)되므로 직접 만들거나 고치지 마세요.

---

## 1. 왜 SSID 읽기에 "위치 권한"이 필요한가

와이파이 이름으로 사용자의 대략적인 위치를 알 수 있기 때문에, 두 OS 모두 SSID를 **위치 정보**로 취급합니다.

| 조건 | Android | iOS | Web |
|---|---|---|---|
| 위치 권한 (앱 사용 중) | 필수 (8.1+, `ACCESS_FINE_LOCATION`) | 필수 (13+) | – |
| 기기 위치 서비스(GPS) 켜짐 | 필수 (9+) | – | – |
| 추가 엔타이틀먼트 | – | **Access WiFi Information** 필수 | – |
| Expo Go에서 동작 | ✅ 대부분 동작 | ❌ (엔타이틀먼트 없음 → `null`) | ❌ 브라우저 API 없음 |
| 개발/배포 빌드에서 동작 | ✅ | ✅ | ❌ |

앱은 결과를 `ok / denied / not-wifi / unavailable / unsupported` 로 나눠 처리하고, 실패하면 이유를 안내한 뒤 수동 입력으로 넘어갑니다 (`src/lib/wifi.ts`).

위치 **좌표는 요청하지도, 저장하지도 않습니다.** 권한은 SSID를 읽기 위해서만 요청합니다.

---

## 2. Android

`app.json` → `expo.android`:

```json
"permissions": [
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION"
],
"blockedPermissions": [
  "android.permission.ACCESS_BACKGROUND_LOCATION"
]
```

- `ACCESS_FINE_LOCATION`: Android 10+ 에서 SSID를 읽으려면 COARSE로는 부족합니다.
- `ACCESS_BACKGROUND_LOCATION` 차단: 백그라운드 위치는 쓰지 않습니다. 이 권한이 들어가면 Play 스토어 심사가 매우 까다로워집니다.
- `INTERNET` 권한은 Expo가 기본으로 넣습니다.

### Google Play 제출 시 체크리스트
- **데이터 보안(Data safety) 양식**: "위치 – 대략적/정확한 위치: 수집 안 함(기기 내에서만 사용)"으로 적고, 앱 기능 용도라고 표시합니다.
- **개인정보처리방침 URL** 필수 (GitHub Pages나 Notion 공개 페이지로 무료 호스팅 가능).
- 사용자 제작 콘텐츠(UGC) 앱이므로 **신고/차단 기능**과 운영 정책이 필요합니다 → 구현되어 있음 ([README 운영 섹션](../README.md#️-운영모더레이션--스토어-ugc-정책-대응)).

---

## 3. iOS

`app.json` → `expo.ios`:

```json
"bundleIdentifier": "com.wifigraffiti.app",
"entitlements": {
  "com.apple.developer.networking.wifi-info": true
}
```

`app.json` → `expo.plugins` (Info.plist 권한 문구 자동 삽입):

```json
["expo-location", {
  "locationWhenInUsePermission": "현재 연결된 와이파이 이름(SSID)으로 장소 보드를 추천하기 위해 위치 권한이 필요합니다. 위치 좌표는 저장·전송되지 않습니다."
}]
```

### Apple Developer 포털에서 할 일 (유료 계정 $99/년 필요)
1. [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → `com.wifigraffiti.app` 선택 (EAS가 자동 생성해 줌)
2. **Capabilities → Access Wi-Fi Information** 체크 후 저장
3. `npx eas-cli@latest build -p ios` 로 다시 빌드 (EAS가 프로비저닝 프로파일을 새로 받아옴)

> Apple 개발자 계정이 아직 없다면: `app.json`에서 `entitlements` 블록을 지우고 빌드하세요. SSID 추천만 빠지고, 나머지 기능은 모두 동작합니다.

### App Store 심사 체크리스트
- 위치 권한 문구에 **왜 필요한지** 구체적으로 적어야 합니다 (위 문구 그대로 사용 가능).
- UGC 앱 가이드라인 1.2: **이용약관 동의, 부적절한 글 신고, 사용자 차단, 운영자 연락처**가 필요합니다. 모두 구현되어 있고, `src/lib/config.ts`의 `CONTACT_EMAIL`만 실제 주소로 바꾸면 됩니다.
- 로그인 없는 익명 앱이므로 "계정 삭제" 요구 사항은 해당하지 않습니다.

---

## 4. 권한 문구/설정을 바꾼 뒤에는

권한과 엔타이틀먼트는 **네이티브 설정**이므로 JS 코드 변경과 달리 다시 빌드해야 적용됩니다.

```bash
# 로컬 (Xcode / Android Studio 필요)
npx expo prebuild --clean
npx expo run:android
npx expo run:ios

# 클라우드 (로컬 도구 불필요, 무료 플랜: 월 빌드 횟수 제한 있음)
npx eas-cli@latest build -p android --profile development
npx eas-cli@latest build -p ios --profile development
```

---

## 5. 빌드 프로필 요약 (`eas.json`)

| 프로필 | 용도 | 결과물 |
|---|---|---|
| `development` | SSID 기능까지 실기기 테스트 (Expo Dev Client) | 내부 배포용 앱 |
| `preview` | 친구/베타 테스터 배포 | Android `.apk`, iOS Ad-hoc |
| `production` | 스토어 제출 | Android `.aab`, iOS `.ipa` |

환경 변수(`EXPO_PUBLIC_SUPABASE_*`)는 `.env.local`이 EAS 클라우드로 올라가지 않으므로, EAS 빌드 전에 등록해야 합니다:

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value xxx --environment preview --visibility plaintext
```

(anon/publishable 키는 원래 앱에 포함되는 공개 키입니다. 보안은 RLS가 담당합니다. **service_role 키는 절대 앱에 넣지 마세요.**)
