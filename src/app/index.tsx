import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { SetupNotice } from '@/components/SetupNotice';
import { useActiveBoards } from '@/hooks/useActiveBoards';
import { useConsent } from '@/hooks/useConsent';
import { useRecentTags } from '@/hooks/useRecentTags';
import { POST_TTL_HOURS, TAG_MAX_LENGTH } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isGenericSsid, isValidTag, normalizeTag, PLACE_CATEGORIES } from '@/lib/tags';
import { colors } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import { describeSsidFailure, detectSsid } from '@/lib/wifi';

/**
 * 장소 선택 화면.
 * 모바일 OS 는 SSID 접근을 강하게 제한하므로 "와이파이 자동 감지"는 보조 수단일 뿐이고,
 * 기본 흐름은 사용자가 장소 태그를 직접 고르거나 입력하는 것이다.
 *   1) 와이파이 이름으로 추천 (가능한 기기에서만)
 *   2) 카테고리 칩 + 직접 입력
 *   3) 최근 방문한 장소
 *   4) 지금 활발한 보드
 */
export default function PlacePicker() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [input, setInput] = useState(next ?? ''); // 공유 링크로 들어왔으면 그 보드를 미리 채워둔다
  const [category, setCategory] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [wifiNote, setWifiNote] = useState<string | null>(null);
  const { tags: recent, remember, forget } = useRecentTags();
  const activeBoards = useActiveBoards();
  const { agreed, agree } = useConsent();
  const [consentNudge, setConsentNudge] = useState(false);

  const composed = normalizeTag(category ? `${category} ${input}` : input);
  const canEnter = isValidTag(composed);

  const enter = (tag: string) => {
    if (!agreed) {
      setConsentNudge(true);
      return;
    }
    remember(tag);
    router.push({ pathname: '/board/[tag]', params: { tag } });
  };

  const onDetect = async () => {
    setDetecting(true);
    setWifiNote(null);
    try {
      const result = await detectSsid();
      if (result.status === 'ok') {
        setCategory(null);
        setInput(result.ssid);
        setWifiNote(
          isGenericSsid(result.ssid)
            ? `"${result.ssid}" 은(는) 흔한 공유기 이름이라 다른 곳과 섞일 수 있어요. 장소 이름을 덧붙여 주세요.`
            : `와이파이 "${result.ssid}" 를 찾았어요. 필요하면 수정 후 입장하세요.`,
        );
      } else {
        setWifiNote(describeSsidFailure(result));
      }
    } catch {
      setWifiNote('와이파이 정보를 읽는 중 오류가 났어요. 장소를 직접 입력해 주세요.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.hero}>지금 어디에 있나요?</Text>
      <Text style={styles.sub}>
        같은 장소 태그를 고른 사람들끼리 익명으로 낙서를 공유해요. 모든 글은 {POST_TTL_HOURS}시간 뒤 사라집니다.
      </Text>

      {!isSupabaseConfigured && <SetupNotice />}

      {agreed === false && (
        <View style={[styles.consent, consentNudge && styles.consentNudge]}>
          <Text style={styles.consentText}>
            욕설·혐오·개인정보·음란물·도배는 금지되며, 신고가 쌓인 글은 자동으로 숨겨집니다. 입장하려면 운영정책과
            개인정보처리방침에 동의해 주세요.
          </Text>
          <View style={styles.consentRow}>
            <Link href="/about" style={styles.consentLink}>
              전문 보기
            </Link>
            <Pressable
              style={styles.consentButton}
              onPress={() => {
                agree();
                setConsentNudge(false);
                // 공유 링크로 들어왔다가 동의 화면으로 온 경우, 원래 보드로 보낸다
                const target = normalizeTag(next ?? '');
                if (isValidTag(target)) {
                  remember(target);
                  router.replace({ pathname: '/board/[tag]', params: { tag: target } });
                }
              }}
            >
              <Text style={styles.consentButtonText}>동의하고 시작하기</Text>
            </Pressable>
          </View>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Pressable style={styles.wifiButton} onPress={onDetect} disabled={detecting}>
          {detecting ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.wifiButtonText}>📶  현재 와이파이 이름으로 찾기</Text>
          )}
        </Pressable>
      )}
      {wifiNote && <Text style={styles.note}>{wifiNote}</Text>}

      <Text style={styles.section}>장소 직접 입력</Text>
      <View style={styles.chips}>
        {PLACE_CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder={category ? `${category} 이름 (예: 스타벅스 강남역점)` : '예: 서울대 중앙도서관 3층'}
        placeholderTextColor={colors.textDim}
        maxLength={TAG_MAX_LENGTH}
        returnKeyType="go"
        onSubmitEditing={() => canEnter && enter(composed)}
        autoCorrect={false}
      />
      {composed.length > 0 && (
        <Text style={styles.preview}>
          보드: <Text style={styles.previewTag}>#{composed}</Text>
          {!canEnter && '  (2자 이상)'}
        </Text>
      )}
      <Pressable
        style={[styles.enter, !canEnter && styles.enterDisabled]}
        disabled={!canEnter}
        onPress={() => enter(composed)}
      >
        <Text style={styles.enterText}>입장하기</Text>
      </Pressable>

      {recent.length > 0 && (
        <>
          <Text style={styles.section}>최근 장소 <Text style={styles.hint}>(길게 눌러 삭제)</Text></Text>
          <View style={styles.chips}>
            {recent.map((t) => (
              <Chip key={t} label={`#${t}`} onPress={() => enter(t)} onLongPress={() => forget(t)} />
            ))}
          </View>
        </>
      )}

      {activeBoards.length > 0 && (
        <>
          <Text style={styles.section}>지금 활발한 보드</Text>
          <View style={styles.chips}>
            {activeBoards.map((b) => (
              <Chip
                key={b.board_key}
                label={`#${b.board_key}`}
                meta={`${b.post_count}개 · ${timeAgo(b.last_post_at)}`}
                onPress={() => enter(b.board_key)}
              />
            ))}
          </View>
        </>
      )}

      <Link href="/about" style={styles.footer}>
        운영정책 · 개인정보처리방침 · 차단 관리
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  hero: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  wifiButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  wifiButtonText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  note: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 },
  hint: { color: colors.textDim, fontSize: 12, fontWeight: '400' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: { color: colors.textDim, fontSize: 13 },
  previewTag: { color: colors.accent, fontWeight: '600' },
  enter: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterDisabled: { opacity: 0.35 },
  enterText: { color: colors.accentText, fontSize: 16, fontWeight: '800' },
  consent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  consentNudge: { borderColor: colors.accent },
  consentText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  consentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  consentLink: { color: colors.textDim, fontSize: 13, textDecorationLine: 'underline' },
  consentButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  consentButtonText: { color: colors.accentText, fontWeight: '700' },
  footer: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 32, textDecorationLine: 'underline' },
});
