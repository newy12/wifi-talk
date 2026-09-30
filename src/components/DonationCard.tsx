import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Typography';
import { DONATION_ACCOUNT } from '@/lib/config';
import { colors, fonts } from '@/lib/theme';

/** 메인 하단 후원 카드: 계좌번호를 보여주고 누르면 복사한다. */
export function DonationCard() {
  const [copied, setCopied] = useState(false);
  if (!DONATION_ACCOUNT) return null;
  const { bank, number, holder } = DONATION_ACCOUNT;

  const copy = async () => {
    const text = `${bank} ${number}`;
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(text);
      else return; // 앱: 복사 대신 번호를 길게 눌러 선택 (selectable)
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 사용자가 번호를 직접 선택해서 복사한다
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>☕ 개발자에게 커피 한 잔</Text>
      <Text style={styles.text}>
        담벼락은 광고 없이 혼자 만들고 운영하고 있어요. 도움이 되셨다면 커피 한 잔으로 응원해 주세요!
      </Text>
      <Pressable onPress={copy} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
        <View style={styles.accountText}>
          <Text style={styles.number} selectable>
            {bank} {number}
          </Text>
          <Text style={styles.holder}>예금주 {holder}</Text>
        </View>
        <Text style={styles.copy}>{copied ? '복사됨 ✓' : '복사'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 32,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  title: { color: colors.text, fontSize: 19, fontFamily: fonts?.brand },
  text: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  pressed: { opacity: 0.7 },
  accountText: { flex: 1, gap: 2 },
  number: { color: colors.text, fontSize: 15, fontWeight: '700' },
  holder: { color: colors.textDim, fontSize: 12 },
  copy: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
