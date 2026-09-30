import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import qrcodeGenerator from 'qrcode-generator';
import { colors, fonts } from '@/lib/theme';
import { formatRoomCode } from '@/lib/rooms';
import { Text } from './Typography';

/** 초대 코드 방 상단: 코드를 크게 보여주고, 누르면 입장 QR 을 펼친다 */
export function RoomInvite({ code }: { code: string }) {
  const [showQr, setShowQr] = useState(false);

  const qrUri = useMemo(() => {
    if (!showQr || Platform.OS !== 'web') return null;
    const qr = qrcodeGenerator(0, 'M');
    qr.addData(`${window.location.origin}/room/${code}`);
    qr.make();
    return qr.createDataURL(6, 2);
  }, [showQr, code]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>초대 코드</Text>
          <Text style={styles.code} selectable>
            {formatRoomCode(code)}
          </Text>
        </View>
        {Platform.OS === 'web' && (
          <Pressable onPress={() => setShowQr((v) => !v)} style={styles.qrButton}>
            <Text style={styles.qrButtonText}>{showQr ? 'QR 닫기' : 'QR 보기'}</Text>
          </Pressable>
        )}
      </View>
      {qrUri && (
        <View style={styles.qrBox}>
          <Image source={{ uri: qrUri }} style={styles.qr} />
          <Text style={styles.hint}>옆 사람이 카메라로 찍으면 바로 들어와요</Text>
        </View>
      )}
      <Text style={styles.hint}>코드를 아는 사람만 들어올 수 있어요. 글이 없으면 30분 뒤, 글이 있으면 마지막 글 24시간 뒤에 방이 사라져요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textDim, fontSize: 12 },
  code: { color: colors.accent, fontSize: 28, fontFamily: fonts?.brand, letterSpacing: 3 },
  qrButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  qrButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  qrBox: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  qr: { width: 200, height: 200, borderRadius: 8, backgroundColor: '#fff' },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
});
