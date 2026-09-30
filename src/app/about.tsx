import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useHiddenContent } from '@/hooks/useHiddenContent';
import { CONTACT_EMAIL, POST_TTL_HOURS, REPORT_HIDE_THRESHOLD } from '@/lib/config';
import { colors } from '@/lib/theme';

/** 운영정책 + 개인정보처리방침. 스토어 심사용 공개 URL 로도 그대로 쓸 수 있다 (웹: /about). */
export default function AboutScreen() {
  const { blockedAuthors, clearBlocked } = useHiddenContent();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>운영정책</Text>
      <Text style={styles.p}>
        WiFi Graffiti 는 같은 장소에 있는 사람들이 익명으로 짧은 글을 남기는 공간입니다. 아래 내용을 게시하면 안 됩니다.
      </Text>
      <Text style={styles.li}>• 욕설, 혐오, 차별, 특정인을 향한 괴롭힘이나 위협</Text>
      <Text style={styles.li}>• 전화번호, 실명, 주소 등 타인의 개인정보</Text>
      <Text style={styles.li}>• 음란물, 불법 정보, 스팸·광고·도배</Text>
      <Text style={styles.p}>
        금칙어와 전화번호가 포함된 글은 자동으로 거부됩니다. 서로 다른 {REPORT_HIDE_THRESHOLD}명이 신고한 글은 즉시 모든
        사용자에게서 숨겨지며, 운영자가 확인해 삭제합니다. 글의 ⋯ 메뉴에서 신고하거나 작성자를 차단할 수 있습니다.
      </Text>

      <Text style={styles.h1}>개인정보처리방침</Text>
      <Text style={styles.h2}>수집하는 정보</Text>
      <Text style={styles.li}>• 작성한 글 내용, 장소 태그, 작성 시각</Text>
      <Text style={styles.li}>• 기기에서 무작위로 만든 익명 태그 (예: 익명-3F2A)</Text>
      <Text style={styles.li}>• 신고 시 신고 사유</Text>
      <Text style={styles.p}>이름, 이메일, 전화번호, 계정, 광고 식별자는 수집하지 않습니다.</Text>

      <Text style={styles.h2}>위치 권한과 와이파이 이름</Text>
      <Text style={styles.p}>
        &quot;와이파이 이름으로 찾기&quot;를 누를 때만 위치 권한을 요청합니다. 운영체제 정책상 와이파이 이름(SSID)을 읽으려면 위치
        권한이 필요하기 때문입니다. 위치 좌표는 읽지 않으며, 와이파이 이름은 서버로 보내지 않습니다. 사용자가 입장 버튼을 눌러
        장소 태그로 확정한 텍스트만 서버에 저장됩니다.
      </Text>

      <Text style={styles.h2}>보관 기간</Text>
      <Text style={styles.p}>
        모든 글은 작성 {POST_TTL_HOURS}시간 뒤 자동으로 영구 삭제됩니다. 장소별로 최신 100개를 넘는 오래된 글도 즉시
        삭제됩니다. 최근 방문 장소, 차단 목록, 익명 태그는 이 기기에만 저장되며 앱을 삭제하면 함께 지워집니다.
      </Text>

      <Text style={styles.h2}>처리 위탁</Text>
      <Text style={styles.p}>데이터는 Supabase(데이터베이스 호스팅)에 저장됩니다.</Text>

      <Text style={styles.h2}>문의 및 게시물 삭제 요청</Text>
      <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
        <Text style={styles.link}>{CONTACT_EMAIL}</Text>
      </Pressable>

      {blockedAuthors.length > 0 && (
        <>
          <Text style={styles.h1}>차단 목록</Text>
          <Text style={styles.p}>{blockedAuthors.join(', ')}</Text>
          <Pressable onPress={clearBlocked} style={styles.button}>
            <Text style={styles.buttonText}>차단 모두 해제</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48, gap: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 16 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  p: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  li: { color: colors.textDim, fontSize: 14, lineHeight: 21, paddingLeft: 4 },
  link: { color: colors.accent, fontSize: 15, textDecorationLine: 'underline' },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  buttonText: { color: colors.text },
});
