import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Post } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { timeAgo, timeLeft } from '@/lib/time';

type Props = { post: Post; mine: boolean; now: number; onMenu: (post: Post) => void };

export const PostItem = memo(function PostItem({ post, mine, now, onMenu }: Props) {
  return (
    <View style={[styles.card, mine && styles.mine]}>
      <View style={styles.header}>
        <Text style={[styles.author, mine && styles.authorMine]}>
          {post.author_tag}
          {mine ? ' (나)' : ''}
        </Text>
        <Text style={styles.time}>{timeAgo(post.created_at, now)}</Text>
      </View>
      <Text style={styles.body}>{post.body}</Text>
      <View style={styles.footer}>
        <Text style={styles.ttl}>{timeLeft(post.expires_at, now)}</Text>
        <Pressable onPress={() => onMenu(post)} hitSlop={12} accessibilityLabel="글 메뉴 (신고/차단)">
          <Text style={styles.menu}>⋯</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  mine: { borderColor: colors.accent },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  author: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  authorMine: { color: colors.accent },
  time: { color: colors.textDim, fontSize: 12 },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ttl: { color: colors.textDim, fontSize: 11 },
  menu: { color: colors.textDim, fontSize: 18, paddingHorizontal: 4 },
});
