import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { DonationCard } from '@/components/DonationCard';
import { PullToRefreshScrollView } from '@/components/PullToRefreshScrollView';
import { SetupNotice } from '@/components/SetupNotice';
import { useActiveBoards } from '@/hooks/useActiveBoards';
import { useConsent } from '@/hooks/useConsent';
import { useSiteOnlineCount } from '@/hooks/usePresence';
import { useRecentTags } from '@/hooks/useRecentTags';
import { POST_TTL_HOURS, TAG_MAX_LENGTH } from '@/lib/config';
import { fetchWifiBoard, isOnCellular } from '@/lib/network';
import { createRoom, isValidRoomCode, normalizeRoomCode } from '@/lib/rooms';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isGenericSsid, isValidTag, normalizeTag, PLACE_CATEGORIES } from '@/lib/tags';
import { colors, fonts } from '@/lib/theme';
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
  const { next, wifi, room } = useLocalSearchParams<{ next?: string; wifi?: string; room?: string }>();
  const [input, setInput] = useState(next ?? ''); // 공유 링크로 들어왔으면 그 보드를 미리 채워둔다
  const [category, setCategory] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [wifiNote, setWifiNote] = useState<string | null>(null);
  const { tags: recent, remember, forget } = useRecentTags();
  const { boards: activeBoards, reload: reloadBoards } = useActiveBoards();
  const { agreed, agree } = useConsent();
  const [consentNudge, setConsentNudge] = useState(false);
  const [wifiCount, setWifiCount] = useState<number | null>(null);
  const online = useSiteOnlineCount();

  const loadWifiCount = useCallback(async () => {
    // 데이터(LTE/5G)일 때의 개수는 통신사 IP 기준이라 의미가 없으므로 표시하지 않는다
    const board = (await isOnCellular()) === true ? null : await fetchWifiBoard();
    setWifiCount(board && !board.cellular ? board.post_count : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWifiCount();
    }, [loadWifiCount]),
  );

  const refresh = () => Promise.all([reloadBoards(), loadWifiCount()]);

  const [roomCode, setRoomCode] = useState('');
  const [roomNote, setRoomNote] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const makeRoom = async () => {
    if (!agreed) {
      setConsentNudge(true);
      return;
    }
    setCreatingRoom(true);
    setRoomNote(null);
    const result = await createRoom();
    setCreatingRoom(false);
    if ('error' in result) setRoomNote(result.error);
    else router.push({ pathname: '/room/[code]', params: { code: result.code } });
  };

  const enterRoom = () => {
    if (!agreed) {
      setConsentNudge(true);
      return;
    }
    const code = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(code)) {
      setRoomNote('코드 6자리를 확인해 주세요 (숫자 0·1, 영문 O·I 는 쓰지 않아요).');
      return;
    }
    setRoomNote(null);
    router.push({ pathname: '/room/[code]', params: { code } });
  };

  const enterWifi = () => {
    if (!agreed) {
      setConsentNudge(true);
      return;
    }
    router.push('/wifi');
  };

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
    <PullToRefreshScrollView
      onRefresh={refresh}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {online ? (
        <View style={styles.online}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>지금 {online}명이 접속 중이에요</Text>
        </View>
      ) : null}
      <Text style={styles.hero}>지금 어디에 있나요?</Text>
      <Text style={styles.sub}>
        같은 와이파이, 같은 장소에 있는 사람들끼리 익명으로 낙서를 나눠요. 모든 글은 {POST_TTL_HOURS}시간 뒤 사라집니다.
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
                if (wifi) {
                  router.replace('/wifi');
                  return;
                }
                if (room) {
                  router.replace({ pathname: '/room/[code]', params: { code: room } });
                  return;
                }
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

      <Pressable style={styles.wifiBoard} onPress={enterWifi}>
        <Text style={styles.wifiBoardTitle}>📶  지금 이 와이파이 사람들</Text>
        <Text style={styles.wifiBoardSub}>
          같은 와이파이에 연결된 사람끼리만 보이는 보드예요. 입력할 것 없이 바로 들어가요.
          {wifiCount ? `  지금 글 ${wifiCount}개` : ''}
        </Text>
      </Pressable>

      <View style={styles.roomCard}>
        <Text style={styles.roomTitle}>🔒 초대 코드 방</Text>
        <Text style={styles.roomSub}>
          핫스팟 모임처럼 몇 명끼리만 쓰는 방이에요. 코드를 아는 사람만 들어오고, 목록에도 안 나와요.
        </Text>
        <Pressable style={styles.roomCreate} onPress={makeRoom} disabled={creatingRoom}>
          {creatingRoom ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.roomCreateText}>새 방 만들기</Text>
          )}
        </Pressable>
        <View style={styles.roomJoinRow}>
          <TextInput
            style={styles.roomInput}
            value={roomCode}
            onChangeText={(t) => setRoomCode(normalizeRoomCode(t))}
            placeholder="코드 6자리"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="go"
            onSubmitEditing={enterRoom}
          />
          <Pressable style={styles.roomJoin} onPress={enterRoom}>
            <Text style={styles.roomJoinText}>입장</Text>
          </Pressable>
        </View>
        {roomNote && <Text style={styles.roomNote}>{roomNote}</Text>}
      </View>

      <Text style={styles.or}>또는 장소 이름으로</Text>

      {Platform.OS !== 'web' && (
        <Pressable style={styles.wifiButton} onPress={onDetect} disabled={detecting}>
          {detecting ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.wifiButtonText}>와이파이 이름으로 장소 태그 채우기</Text>
          )}
        </Pressable>
      )}
      {wifiNote && <Text style={styles.note}>{wifiNote}</Text>}

      <Text style={styles.section}>장소 태그 입력</Text>
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

      <DonationCard />

      <Link href="/about" style={styles.footer}>
        운영정책 · 개인정보처리방침 · 차단 관리
      </Link>
    </PullToRefreshScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  onlineText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  hero: { color: colors.text, fontSize: 32, fontFamily: fonts?.brand, lineHeight: 40 },
  sub: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  wifiBoard: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 18,
    gap: 6,
    marginTop: 8,
  },
  wifiBoardTitle: { color: colors.accentText, fontSize: 22, fontFamily: fonts?.brand },
  wifiBoardSub: { color: colors.accentText, fontSize: 13, lineHeight: 19, opacity: 0.8 },
  roomCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  roomTitle: { color: colors.text, fontSize: 20, fontFamily: fonts?.brand },
  roomSub: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  roomCreate: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomCreateText: { color: colors.accent, fontWeight: '800', fontSize: 15 },
  roomJoinRow: { flexDirection: 'row', gap: 8 },
  roomInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: '700',
  },
  roomJoin: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
  },
  roomJoinText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  roomNote: { color: colors.danger, fontSize: 13 },
  or: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 12 },
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
