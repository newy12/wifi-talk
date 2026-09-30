import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  active?: boolean;
  meta?: string;
};

export function Chip({ label, onPress, onLongPress, active, meta }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}
    >
      <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
        {label}
        {meta ? <Text style={styles.meta}>  {meta}</Text> : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 260,
  },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  label: { color: colors.text, fontSize: 14 },
  activeLabel: { color: colors.accentText, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12 },
});
