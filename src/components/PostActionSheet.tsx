import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Post } from '@/lib/supabase';
import { REPORT_REASONS, type ReportReason } from '@/lib/config';
import { colors } from '@/lib/theme';

type Props = {
  post: Post | null;
  mine: boolean;
  onClose: () => void;
  onReport: (post: Post, reason: ReportReason) => Promise<string | null>;
  onBlock: (post: Post) => void;
};

/**
 * 글 메뉴 (신고 / 작성자 차단).
 * Alert.alert 는 웹에서 버튼 선택을 지원하지 않으므로 Modal 로 직접 만든다.
 */
export function PostActionSheet({ post, mine, onClose, onReport, onBlock }: Props) {
  const [step, setStep] = useState<'menu' | 'reasons' | 'done'>('menu');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const close = () => {
    setStep('menu');
    setMessage(null);
    onClose();
  };

  const report = async (reason: ReportReason) => {
    if (!post || busy) return;
    setBusy(true);
    const err = await onReport(post, reason);
    setBusy(false);
    setMessage(err ?? '신고가 접수되었어요. 이 글은 내 화면에서 숨겨집니다.');
    setStep('done');
  };

  return (
    <Modal visible={post !== null} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
          {step === 'menu' && (
            <>
              <Text style={styles.preview} numberOfLines={2}>
                “{post?.body}”
              </Text>
              {!mine && (
                <>
                  <Item label="🚩  이 글 신고하기" onPress={() => setStep('reasons')} />
                  <Item
                    label={`🚫  ${post?.author_tag} 의 글 모두 숨기기`}
                    onPress={() => {
                      if (post) onBlock(post);
                      close();
                    }}
                  />
                </>
              )}
              {mine && <Text style={styles.note}>내가 쓴 글이에요. 24시간 뒤 자동으로 사라집니다.</Text>}
              <Item label="닫기" onPress={close} dim />
            </>
          )}
          {step === 'reasons' && (
            <>
              <Text style={styles.title}>신고 사유를 선택해 주세요</Text>
              {REPORT_REASONS.map((r) => (
                <Item key={r.value} label={r.label} onPress={() => report(r.value)} disabled={busy} />
              ))}
              <Item label="취소" onPress={close} dim />
            </>
          )}
          {step === 'done' && (
            <>
              <Text style={styles.title}>{message}</Text>
              <Text style={styles.note}>여러 명이 신고한 글은 모든 사람에게서 자동으로 숨겨져요.</Text>
              <Item label="확인" onPress={close} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Item({ label, onPress, dim, disabled }: { label: string; onPress: () => void; dim?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.item, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.itemText, dim && styles.dim]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 4,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  preview: { color: colors.textDim, fontSize: 14, marginBottom: 8, fontStyle: 'italic' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  note: { color: colors.textDim, fontSize: 13, marginVertical: 8, lineHeight: 18 },
  item: { paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10 },
  pressed: { backgroundColor: colors.surfaceHigh },
  disabled: { opacity: 0.4 },
  itemText: { color: colors.text, fontSize: 16 },
  dim: { color: colors.textDim, textAlign: 'center' },
});
