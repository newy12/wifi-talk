import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'WiFi Graffiti' }} />
        <Stack.Screen name="board/[tag]" options={{ title: '' }} />
        <Stack.Screen name="wifi" options={{ title: '📶 이 와이파이' }} />
        <Stack.Screen name="about" options={{ title: '운영정책 · 개인정보' }} />
      </Stack>
    </>
  );
}
