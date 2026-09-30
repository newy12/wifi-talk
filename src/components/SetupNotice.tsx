import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Typography';
import { colors } from '@/lib/theme';

/** .env.local 이 없을 때 앱이 크래시하는 대신 보여주는 안내 */
export function SetupNotice() {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Supabase 연결이 필요해요</Text>
      <Text style={styles.text}>
        로컬: npm run db:start → npm run env:local → npm run dev{'\n'}
        운영: .env.local 에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 입력 후 npm run dev{'\n'}
        (자세한 내용은 README.md)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  title: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  text: { color: colors.text, fontSize: 13, lineHeight: 20 },
});
