import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { POST_MAX_LENGTH } from '@/lib/config';
import { colors, fonts } from '@/lib/theme';

type Props = { onSubmit: (body: string) => Promise<string | null> };

export function Composer({ onSubmit }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSend = text.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const err = await onSubmit(text);
    setSending(false);
    setError(err);
    if (!err) setText('');
  };

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (error) setError(null);
          }}
          placeholder="이 장소에 낙서 남기기 (24시간 뒤 사라져요)"
          placeholderTextColor={colors.textDim}
          maxLength={POST_MAX_LENGTH}
          multiline
          submitBehavior="blurAndSubmit"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={[styles.button, !canSend && styles.buttonDisabled]}
        >
          {sending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>남기기</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.counter}>
        {text.length}/{POST_MAX_LENGTH}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 19,
    fontFamily: fonts?.post,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.accentText, fontWeight: '700' },
  counter: { color: colors.textDim, fontSize: 11, textAlign: 'right', marginTop: 4 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 6 },
});
